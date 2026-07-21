# PRD — Dash Ultimates: monitoramento de renovação do Ultimate

**Date:** 2026-07-19
**Status:** Approved (decisões validadas em entrevista com o owner)
**Owner:** Alberani

## 1. Contexto e problema

O Ultimate é vendido em ciclos: a cada ciclo de renovação, um **produto novo** é criado na Hotmart e a base de compradores existente é convidada a renovar comprando esse produto. Hoje não existe nenhuma visão que responda, durante a campanha: *quem da base já renovou? quem falta abordar? quantos novos compradores entraram?*

O sistema já possui integração completa com a Hotmart **na mesma conta em que o produto de renovação é vendido**:

- Crons `daily`/`weekly` (`/api/cron/hotmart/*`) sincronizam todas as vendas da conta para `dash_gestao_hotmart_sales` (o daily cobre os últimos 3 dias a cada execução, capturando confirmações de PIX/boleto).
- Um webhook em `/api/hotmart/webhook`, autenticado por HOTTOK (`HOTMART_WEBHOOK_TOKEN`), atualiza em tempo real o **status** de vendas já registradas.
- Produtos e ofertas ficam sincronizados em `dash_gestao_hotmart_products` / `dash_gestao_hotmart_offers`.

**Objetivo:** novo módulo "Dash Ultimates" no menu inicial que cruza, **por email**, a lista da base de compradores (upload por ciclo) com as vendas do produto de renovação — classificando cada pessoa (Renovado, Não renovado, Renovação reembolsada) e categorizando compradores fora da base como Novos Compradores. Tudo construído **sobre os dados que já fluem para o banco**, sem integração nova com a Hotmart.

**Princípio de arquitetura (exigência do owner):** a feature não pode adicionar peso ao sistema nem interferir no funcionamento atual. Consequências diretas: nenhum cron novo, nenhum webhook novo, nenhum HOTTOK novo; a classificação é **derivada em leitura** (RPC no banco), nunca um estado sincronizado por jobs; o único toque em código compartilhado (webhook existente) é **aditivo e à prova de falha**.

## 2. Escopo

### Incluído (v1)

- Card **"Dash Ultimates"** no menu inicial (`SelectionCards`), visível para `gestor` e `analista`; rota nova `/ultimates`.
- **Ciclos de renovação**: cadastro com nome, produto Hotmart (selecionado da lista já sincronizada), meta opcional e status `ativo`/`encerrado`. Múltiplos ciclos, histórico permanente, dashboard abre no ciclo ativo mais recente com seletor para os demais.
- **Upload da base** por ciclo: arquivo CSV **ou** colar da planilha; coluna `email` obrigatória, `nome`/`telefone` reconhecidas quando presentes, demais colunas preservadas em JSONB (lista personalizável). Re-upload = substituição total **com prévia de impacto**.
- **Classificação derivada** por email: Renovado · Não renovado · Renovação reembolsada · Novo Comprador · Novo — reembolsado.
- **Frescor em três camadas**: (i) tempo real via passo aditivo no webhook existente; (ii) botão "Atualizar agora" com busca escopada ao produto do ciclo; (iii) pente fino diário = cron existente, intocado.
- **Dashboard**: KPIs por categoria, meta com barra de progresso (quando cadastrada), gráfico de renovações acumuladas por dia (Recharts), tabela com busca/filtro por categoria, **exportação CSV** da visão filtrada.
- **Vínculo manual** (só `gestor`): associar uma venda de "Novos Compradores" a um comprador da base (caso do email diferente), com trilha de auditoria.

### Fora de escopo (v1)

| Item | Motivo |
|---|---|
| Webhook/HOTTOK dedicado ao produto | O produto é vendido na conta Hotmart já conectada; as vendas já chegam pelos fluxos existentes |
| Cruzamento por CPF/telefone | Email é o dado de referência definido pelo owner; o furo do "email diferente" é coberto pelo vínculo manual |
| Marcação manual livre de "Renovado" sem venda | Rejeitada na entrevista: descolaria o dashboard da realidade financeira. Todo Renovado ancora numa venda real |
| Merge incremental de uploads | Rejeitado: substituição total com prévia é o modelo mental adotado ("a lista no sistema é o espelho da última planilha") |
| Disparo de comunicação (WhatsApp/email) a não-renovados | O dashboard entrega a lista exportada; abordagem acontece fora do sistema |
| Novos crons ou agendamentos | O pente fino diário já é coberto pelo cron `daily` existente (lookback de 3 dias sobre todas as vendas da conta) |

## 3. Experiência do usuário

### 3.1 Menu inicial

- Novo card "Dash Ultimates" no grid do `SelectionCards`, seguindo a anatomia dos existentes (ícone, accent próprio, descrição curta).
- Visibilidade por papel no padrão atual (`restrictedTo`): bloqueado para `comum`; `gestor` e `analista` acessam.

### 3.2 Tela `/ultimates`

1. **Sem nenhum ciclo cadastrado:** estado vazio com CTA "Criar ciclo" (visível só para `gestor`).
2. **Com ciclos:** abre no ciclo `ativo` mais recente; seletor discreto no topo alterna para outros ciclos (incluindo encerrados — dashboard histórico completo, somente leitura de operação).
3. **Ciclo sem base carregada:** KPIs de base zerados, seção de Novos Compradores já funcional (vendas do produto aparecem), CTA "Carregar base" para `gestor`.

### 3.3 Cadastro de ciclo (só `gestor`)

- Campos: **nome** (ex.: "Renovação Ultimate 2027"), **produto Hotmart** (dropdown alimentado por `dash_gestao_hotmart_products`, com aviso para rodar o sync de produtos caso o produto recém-criado ainda não apareça), **meta** opcional (% da base a renovar), **status**.
- Encerrar um ciclo é uma ação explícita; ciclo encerrado congela a operação (sem upload/vínculo) mas o dashboard continua acessível.

### 3.4 Upload da base (só `gestor`)

- Duas entradas equivalentes: **arquivo CSV** e **textarea "colar da planilha"** (conteúdo TSV copiado do Sheets/Excel). O parsing interno é o mesmo.
- Primeira linha = cabeçalho. Mapeamento automático: coluna contendo `email` (case-insensitive) é a chave; `nome`/`name` e `telefone`/`phone`/`celular` são reconhecidas; **todas as demais colunas vão para `extra` (JSONB)** sem perda.
- Validação na tela: linhas sem email válido são listadas e ignoradas; emails duplicados no arquivo são deduplicados (última ocorrência vence), com aviso.
- **Prévia de impacto obrigatória** quando já existe base: "Você vai substituir 320 compradores por 315 — 12 emails saem, 7 entram. Confirmar?" Só então o commit acontece.

### 3.5 Dashboard do ciclo

```
┌──────────────────────────────────────────────────────────────┐
│ Renovação Ultimate 2027              [seletor de ciclo ▾]    │
│                                                              │
│  Base    Renovados     Reembolsadas  Não renov.  Novos       │
│  320     184 (57,5%)   6             130         41 (+2 ⟲)   │
│                                                              │
│  Meta 60% ─ ██████████████████░░░░░ 57,5%                    │
│                                                              │
│  [gráfico: renovações acumuladas por dia da campanha]        │
│                                                              │
│  [busca…] [filtro: categoria ▾]              [Exportar CSV]  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ nome · email · telefone · categoria · data · valor     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                        [Atualizar agora ⟳]  │
└──────────────────────────────────────────────────────────────┘
```

- **KPIs**: Base (total da lista) · Renovados (nº e %) · Renovação reembolsada · Não renovados · Novos Compradores (com contagem de "Novo — reembolsado").
- **Meta**: barra de progresso apenas se cadastrada no ciclo; sem meta, só os números.
- **Gráfico**: renovações acumuladas por dia (`approved_date`), Recharts, formatação pt-BR nos padrões do projeto (`—` para indisponível, nunca `0` enganoso).
- **Tabela**: busca por nome/email; filtro por categoria; colunas nome, email, telefone, categoria, data da renovação e valor pago (quando houver venda). Na categoria "Novos Compradores", ação **"Vincular à base"** (só `gestor`) abre modal de busca de comprador da base.
- **Exportar CSV**: exporta a visão filtrada atual (categoria + busca aplicadas), incluindo as colunas extras do upload.
- **"Atualizar agora"**: dispara a busca escopada; feedback de progresso e de última atualização ("Vendas atualizadas há X min", a partir do maior `collected_at` das vendas do produto).

## 4. Regras de negócio

### 4.1 Cruzamento

- Chave de cruzamento: **email normalizado** = `lower(trim(email))`, aplicado nos dois lados (base e `buyer_email` das vendas).
- Universo de vendas do ciclo: linhas de `dash_gestao_hotmart_sales` com `product_id` = produto do ciclo.
- Vínculo manual tem precedência: uma venda vinculada manualmente a um comprador da base conta para **esse** comprador, independentemente do email.

### 4.2 Categorias (sempre derivadas do status atual das vendas)

Para cada **comprador da base**, considerando todas as suas vendas do produto (por email ou vínculo manual):

| Categoria | Regra |
|---|---|
| **Renovado** | Possui ao menos uma venda com status `APPROVED` ou `COMPLETE` |
| **Renovação reembolsada** | Não é Renovado, mas possui venda com status `REFUNDED`, `CHARGEBACK`, `CANCELLED` ou `EXPIRED` |
| **Não renovado** | Nenhuma venda do produto |

Para cada **venda do produto cujo email não está na base** e sem vínculo manual (agrupado por email do comprador):

| Categoria | Regra |
|---|---|
| **Novo Comprador** | Ao menos uma venda `APPROVED`/`COMPLETE` |
| **Novo — reembolsado** | Só vendas em status de estorno/cancelamento |

- Reembolso **rebaixa** automaticamente: como tudo é derivado do status atual (mantido pelo webhook + crons), um Renovado que estorna passa a "Renovação reembolsada" sem qualquer ação manual — e volta a "Renovado" se comprar de novo.
- Vendas em status transitórios de não-aprovação (ex.: `BILLET_PRINTED`, `WAITING_PAYMENT`) não marcam renovação; a pessoa permanece "Não renovado" até a aprovação chegar.

### 4.3 Re-upload (substituição com prévia)

- O novo upload **substitui integralmente** a base do ciclo. A prévia mostra: total anterior → total novo, emails que saem, emails que entram.
- Seguro por construção: nenhum status é armazenado no comprador — a classificação se recalcula sozinha após a troca. Vínculos manuais de emails que **permanecem** na base são preservados; vínculos de emails removidos são descartados (a venda volta a "Novos Compradores").

### 4.4 Vínculo manual (caso do email diferente)

- Só `gestor`. A partir de uma venda em "Novos Compradores", o gestor seleciona o comprador da base correspondente ("essa compra de fulano@gmail é a renovação da Maria").
- Efeito: a venda passa a contar para o comprador da base (que vira Renovado/Reembolsado conforme o status); sai de Novos Compradores.
- Auditoria: registra quem vinculou e quando. Vínculo pode ser desfeito (também auditado).
- Uma venda vincula a no máximo um comprador da base; um comprador pode ter múltiplas vendas (email + vínculos).

## 5. Requisitos funcionais

- **RF-1** — Card "Dash Ultimates" no menu inicial; `comum` vê o card desabilitado ("Restrito"), `gestor`/`analista` acessam `/ultimates`.
- **RF-2** — CRUD de ciclos restrito a `gestor` (nome, produto da lista sincronizada, meta opcional, status ativo/encerrado); múltiplos ciclos; dashboard abre no ativo mais recente com seletor.
- **RF-3** — Upload de base por CSV ou colagem, com mapeamento automático de colunas (`email` obrigatória; `nome`/`telefone` reconhecidas; extras em JSONB), validação de emails e deduplicação com aviso.
- **RF-4** — Re-upload exige prévia de impacto (contagens e diffs de emails) antes do commit; commit substitui a base atomicamente.
- **RF-5** — Classificação de cada comprador e de cada novo comprador conforme as regras da seção 4.2, **calculada em leitura** — nunca armazenada como status no registro.
- **RF-6** — Vendas novas do produto monitorado inseridas em tempo real pelo passo aditivo do webhook (seção 6.4); falha nesse passo não pode afetar o comportamento atual do webhook (resposta e atualização de status seguem idênticas).
- **RF-7** — Botão "Atualizar agora" busca na API Hotmart **apenas** o produto do ciclo e faz upsert em `dash_gestao_hotmart_sales`; protegido por lock e intervalo mínimo entre execuções.
- **RF-8** — O cron diário existente permanece intocado e atua como reconciliação (pente fino): qualquer venda perdida pelo webhook entra em até 1 dia; divergências de preço do payload do webhook são corrigidas pelos dados canônicos da API.
- **RF-9** — Dashboard exibe KPIs, meta (se houver), gráfico de renovações acumuladas por dia e tabela com busca + filtro por categoria.
- **RF-10** — Exportação CSV da visão filtrada, incluindo colunas extras do upload.
- **RF-11** — Vínculo manual e desvínculo (só `gestor`) com auditoria (usuário + timestamp); venda vinculada conta para o comprador da base e sai de Novos Compradores.
- **RF-12** — Ciclo encerrado: dashboard acessível como histórico; operações de escrita (upload, vínculo, edição) bloqueadas.

## 6. Requisitos técnicos

### 6.1 Persistência — novas tabelas (migration sequencial após a última existente)

Padrão de RLS do projeto: leitura `authenticated`, escrita via `service_role` (APIs).

**`dash_gestao_ultimates_cycles`**

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `name` | text not null | ex.: "Renovação Ultimate 2027" |
| `account_id` | uuid not null fk → `dash_gestao_accounts(id)` | conta Hotmart do produto |
| `product_id` | text not null fk → `dash_gestao_hotmart_products(product_id)` | produto de renovação do ciclo |
| `goal_percent` | numeric null | meta opcional (% da base) |
| `status` | text not null default `'ativo'` | `ativo` \| `encerrado` (check) |
| `refresh_started_at` | timestamptz null | lock do "Atualizar agora" (expira ~2 min, padrão do lock do Six Dados) |
| `last_refresh_at` | timestamptz null | throttle do botão (intervalo mínimo 60s) |
| `created_by` | uuid null | auditoria |
| `created_at` / `updated_at` | timestamptz | padrão do projeto |

**`dash_gestao_ultimates_buyers`**

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `cycle_id` | uuid not null fk → cycles `on delete cascade` | |
| `email` | text not null | **normalizado** (`lower(trim())`) no insert; unique `(cycle_id, email)` |
| `name` | text null | coluna `nome`/`name` do upload |
| `phone` | text null | coluna `telefone`/`phone`/`celular` do upload |
| `extra` | jsonb not null default `'{}'` | demais colunas do upload, sem perda |
| `created_at` | timestamptz | |

**`dash_gestao_ultimates_manual_links`**

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `cycle_id` | uuid not null fk → cycles `on delete cascade` | |
| `buyer_id` | uuid not null fk → buyers `on delete cascade` | remoção do email no re-upload desfaz o vínculo (RF do 4.3) |
| `transaction_code` | text not null unique | venda vinculada (1 venda → 1 comprador) |
| `linked_by` | uuid not null | auditoria |
| `created_at` | timestamptz | |

**Índice novo em tabela existente** (única mudança em `dash_gestao_hotmart_sales`, não destrutiva):

```sql
create index idx_hotmart_sales_product_buyer_email
  on dash_gestao_hotmart_sales (product_id, lower(buyer_email));
```

### 6.2 Classificação em leitura — RPCs

Duas funções SQL (`security definer` não é necessário; leitura `authenticated` já é permitida pelas RLS):

- **`dash_gestao_ultimates_roster(p_cycle_id uuid)`** — retorna uma linha por comprador da base (id, nome, email, telefone, extra, categoria, data da renovação = menor `approved_date` aprovado, valor, transaction_code) **e** uma linha por novo comprador (agrupado por email, categoria Novo/Novo-reembolsado), aplicando as regras da seção 4.2 com join indexado `product_id + lower(buyer_email)` e os vínculos manuais.
- **`dash_gestao_ultimates_daily(p_cycle_id uuid)`** — série diária de renovações aprovadas (`approved_date::date`, contagem), para o gráfico acumulado (acúmulo feito no cliente).

KPIs são agregados no cliente a partir do roster (mesma fonte da tabela — números sempre batem). Bases desse produto têm centenas a poucos milhares de linhas; uma RPC única é leve e elimina qualquer risco de divergência entre KPI e tabela.

### 6.3 APIs (novas rotas em `/api/ultimates/*`, autenticadas no padrão do projeto)

| Endpoint | Método | Acesso | Comportamento |
|---|---|---|---|
| `/api/ultimates/cycles` | GET | gestor, analista | Lista ciclos (com produto e meta) |
| `/api/ultimates/cycles` | POST | gestor | Cria ciclo; valida produto existente em `dash_gestao_hotmart_products` |
| `/api/ultimates/cycles/[id]` | PATCH | gestor | Edita nome/meta/status (encerrar) |
| `/api/ultimates/cycles/[id]/roster` | GET | gestor, analista | Chama a RPC `roster`; resposta única para KPIs + tabela |
| `/api/ultimates/cycles/[id]/daily` | GET | gestor, analista | Série diária para o gráfico |
| `/api/ultimates/cycles/[id]/buyers` | POST | gestor | Body `{ mode: "preview" \| "commit", rows: [...] }`. `preview`: retorna diffs sem gravar. `commit`: substituição atômica (delete + insert na mesma transação via função SQL), preservando vínculos de emails mantidos |
| `/api/ultimates/cycles/[id]/refresh` | POST | gestor, analista | "Atualizar agora": lock via update condicional de `refresh_started_at` (atômico, roubável após ~2 min), throttle de 60s via `last_refresh_at`; busca `sales/history` da Hotmart **filtrada por `product_id`** (parâmetro nativo da API) no período do ciclo e upserta em `dash_gestao_hotmart_sales` reutilizando o mapeamento de `collectHotmart` |
| `/api/ultimates/links` | POST / DELETE | gestor | Cria/desfaz vínculo manual; valida que a transação pertence ao produto do ciclo e não está vinculada |

- O parsing de CSV/TSV roda **no cliente** (arquivo pequeno, sem lib nova no servidor): o front envia `rows` já estruturadas (`email`, `name`, `phone`, `extra`); o servidor revalida email e normaliza.
- Exportação CSV: gerada **no cliente** a partir do roster já carregado (visão filtrada) — nenhum endpoint novo.
- A busca escopada do `refresh` reutiliza `fetchHotmartToken` e o mapeamento de linhas de `src/lib/services/hotmart.ts` (extraídos para função compartilhada), sem alterar o comportamento de `collectHotmart`.

### 6.4 Extensão aditiva do webhook existente (`/api/hotmart/webhook`)

Único toque em código compartilhado. Após o fluxo atual (update de status por `transaction_code`), um passo novo **isolado em `try/catch` próprio**:

1. Extrai `data.product.id` e `data.buyer.email` do payload (campos padrão do webhook v2 da Hotmart).
2. Consulta ciclos `ativos` cujo `product_id` bate (lookup indexado, ~0 custo; cacheável em memória por invocação).
3. Se houver match, **upsert** da venda em `dash_gestao_hotmart_sales` (`onConflict: transaction_code`) com os campos disponíveis no payload (transaction, status, product, buyer_email, price, datas), marcando `collected_at`.
4. Qualquer erro nesse passo é engolido (logado), e a resposta do webhook permanece a atual — o comportamento existente (atualização de status das demais vendas) **não muda em nenhum cenário**.

O dado do webhook é **provisório**: o preço no payload pode divergir do cálculo canônico via `hotmart_fee` da API. O cron diário (pente fino) e o "Atualizar agora" sobrescrevem a linha com os dados canônicos — mesmo `transaction_code`, upsert idempotente.

### 6.5 Frontend

- `src/components/layout/selection-cards.tsx`: novo item no array `MODULES` (`href: "/ultimates"`, `restrictedTo: ["comum"]`, accent próprio).
- Novas telas/componentes: `src/app/ultimates/page.tsx` + componentes em `src/components/ultimates/` (KPIs, gráfico, tabela, modais de ciclo/upload/vínculo). Padrões visuais e formatters existentes do projeto (pt-BR, BRL, `—` para indisponível).
- Gates de escrita por papel também na UI (botões ocultos para `analista`), com a validação real nos endpoints.
- Antes de codificar, ler os guias em `node_modules/next/dist/docs/` (convenção do projeto — esta versão do Next.js tem breaking changes).

## 7. Critérios de aceite

1. Card "Dash Ultimates" aparece no menu inicial para `gestor`/`analista` e como "Restrito" para `comum`; a rota `/ultimates` rejeita `comum`.
2. `gestor` cria um ciclo selecionando um produto sincronizado; `analista` não vê ações de criação/edição e recebe 403 nos endpoints de escrita.
3. Upload por arquivo e por colagem produzem o mesmo resultado; linhas sem email válido são reportadas e ignoradas; colunas desconhecidas aparecem preservadas na exportação.
4. Re-upload sobre base existente exige confirmação com contagens corretas de "saem/entram"; após o commit, a classificação reflete a lista nova sem nenhuma ação extra.
5. Comprador da base com venda `APPROVED` do produto aparece como Renovado com data e valor; se a venda muda para `REFUNDED` (via webhook ou cron), passa a "Renovação reembolsada" na leitura seguinte, sem intervenção.
6. Venda do produto com email fora da base aparece em Novos Compradores; após vínculo manual, o comprador da base vira Renovado e a venda sai de Novos Compradores; desfazer o vínculo reverte ambos.
7. Compra aprovada na Hotmart aparece no dashboard em tempo real (webhook) sem esperar o cron; payload malformado ou erro de banco no passo novo do webhook não altera a resposta nem o update de status atual (cobertura de teste explícita).
8. "Atualizar agora" traz vendas do produto imediatamente; dois cliques simultâneos executam **uma** busca (lock); clique repetido dentro de 60s é recusado com feedback.
9. KPIs, gráfico e tabela batem entre si (mesma RPC) e a % de renovação usa a base como denominador; meta cadastrada exibe barra de progresso.
10. Exportar CSV com filtro "Não renovado" gera arquivo só com essa categoria, incluindo nome, email, telefone e colunas extras.
11. Ciclo encerrado: dashboard acessível, operações de escrita bloqueadas (UI e API); ciclo novo convive com o encerrado e o seletor alterna entre eles.
12. Fluxos existentes intocados: dashboards Hotmart atuais, crons e webhook (para produtos não monitorados) se comportam de forma idêntica — nenhuma migração altera ou remove dados existentes (única mudança: índice novo).

## 8. Riscos e pontos de atenção

- **Payload do webhook ≠ dados canônicos da API:** preço e campos do webhook v2 podem divergir do cálculo via `hotmart_fee`. Mitigado por design: webhook insere dado provisório; cron diário e "Atualizar agora" sobrescrevem com o canônico (upsert por `transaction_code`).
- **Produto recém-criado ainda não sincronizado:** o dropdown do ciclo depende de `dash_gestao_hotmart_products`. A UI orienta a rodar o sync de produtos (`/api/hotmart/sync-products`) quando o produto não aparece.
- **Emails divergentes:** o cruzamento por email nunca será 100% — o vínculo manual é a válvula. A tabela de Novos Compradores é a fila natural de revisão para o gestor.
- **Volume:** base de centenas/poucos milhares de linhas × vendas de um único produto — o join indexado (`product_id, lower(buyer_email)`) mantém a RPC em milissegundos. Nenhuma tabela quente nova, nenhum job novo: o peso marginal no sistema é desprezível.
- **Lock do refresh:** update condicional atômico de `refresh_started_at` (mesmo padrão validado no Six Dados), roubável após ~2 min para não travar o botão em caso de invocação morta.
- **Substituição atômica da base:** delete + insert precisam ocorrer na mesma transação (função SQL), para nenhum leitor enxergar base vazia no meio do commit.
- **Privacidade:** a base contém dados pessoais (email/telefone). Acesso restrito por papel; exportação disponível apenas a quem já vê os dados na tela.

## 9. Decisões registradas (entrevista de 2026-07-19)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Fonte dos dados de renovação | Mesma conta Hotmart já conectada — sem webhook/HOTTOK novo; cruzamento sobre `dash_gestao_hotmart_sales` |
| 2 | Identificação do produto | Produto novo a cada ciclo; seleção **configurável na UI** a partir dos produtos sincronizados |
| 3 | Formato do upload | CSV **e** colar da planilha; `email` obrigatório, `nome`/`telefone` opcionais, colunas extras em JSONB (lista personalizável) |
| 4 | Re-upload | Substituição total **com prévia de impacto** |
| 5 | Reembolso pós-renovação | Categoria própria "Renovação reembolsada" (e "Novo — reembolsado" para novos compradores) |
| 6 | Frescor | A+B+C: tempo real (webhook aditivo) + botão "Atualizar agora" (busca escopada) + pente fino diário (cron existente, intocado) |
| 7 | Acesso | Card para `gestor` e `analista`; operações de escrita só `gestor`; `comum` bloqueado |
| 8 | UI | KPIs, tabela com busca/filtro, gráfico acumulado, **exportação CSV** e **meta opcional** com progresso |
| 9 | Ciclos | Múltiplos ciclos com status ativo/encerrado e histórico permanente; abre no ativo mais recente |
| 10 | Email diferente na renovação | **Vínculo manual** de venda de Novos Compradores a comprador da base, com auditoria; sem marcação livre |
