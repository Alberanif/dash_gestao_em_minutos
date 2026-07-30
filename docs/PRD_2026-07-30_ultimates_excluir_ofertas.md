# PRD — Dash Ultimates: excluir ofertas da contabilidade

**Date:** 2026-07-30
**Status:** Approved (decisões validadas em entrevista com o owner)
**Owner:** Alberani
**Depende de:** Dash Ultimates (issue #114) — migrations 049/050/051 e rotas `/api/ultimates/*`

## 1. Contexto e problema

O Dash Ultimates conta como renovação (ou como novo comprador) **toda** venda de `dash_gestao_hotmart_sales` cujo `product_id` é o produto do ciclo. Não há recorte por oferta.

Na prática, nem toda venda daquele produto é uma renovação real: existem **compras de teste e internas** — testes de checkout, cortesias, cupons de 100%, compras da própria equipe — que entram no mesmo produto sob uma oferta própria. Elas inflam os KPIs, aparecem como "Novo Comprador" no roster e viram pontos na curva do card Evolução. São poucas e pontuais, mas contaminam exatamente o número que o dashboard existe para responder.

**Objetivo:** permitir que o gestor marque ofertas Hotmart cujas compras não devem contar, e remover essas vendas de toda a contabilidade do ciclo.

**Princípio de arquitetura (herdado do módulo):** a classificação do Ultimates é **derivada em leitura**, nunca armazenada. Portanto "excluir" não apaga nem altera nenhuma venda — é um **filtro aplicado no universo de vendas** dentro das RPCs. Os dados brutos em `dash_gestao_hotmart_sales` permanecem intactos e completos, o que torna a exclusão totalmente reversível.

## 2. Escopo

### Incluído

- Nova tabela `dash_gestao_ultimates_excluded_offers`: lista de ofertas excluídas **por ciclo**, com autoria e nota opcional.
- Filtro por `offer_code` nas duas RPCs de leitura (`dash_gestao_ultimates_roster` e `dash_gestao_ultimates_daily`), aplicado **antes** de qualquer atribuição de venda a comprador.
- Rotas de gestão da lista (`GET`/`POST`/`DELETE`) e rota de opções de oferta do ciclo (código, nome e nº de vendas).
- Modal "Ofertas excluídas" acionado por botão na barra de ações do ciclo, com seletor de ofertas reais, nota opcional, lista das excluídas e remoção.
- Sinalização na tela de que existe filtro em vigor (badge no botão + nota no card "01 Visão do ciclo").
- Bloqueio de vínculo manual em transação de oferta excluída.

### Fora de escopo

| Item | Motivo |
|---|---|
| Escopo global / outros dashboards | A exclusão é **por ciclo**. Indicadores, dashboard Hotmart e `get_hotmart_metrics` seguem intocados |
| Excluir venda individual por `transaction_code` | O recorte pedido é por oferta; venda avulsa de teste sem oferta própria continua fora do alcance |
| Alterar a coleta Hotmart | Crons, webhook e "Atualizar agora" continuam coletando e gravando **todas** as vendas do produto — é o que mantém a exclusão reversível |
| Whitelist (lista de ofertas válidas) | Rejeitada na entrevista: para um punhado de ofertas espúrias, a manutenção de uma lista de permissão é maior que o problema |
| Histórico de alterações da lista | A tabela guarda quem/quando da exclusão vigente; remover apaga a linha, sem trilha de auditoria própria (mesmo modelo do unlink de vínculo manual) |

## 3. Experiência do usuário

### 3.1 Acesso

Botão **"Ofertas excluídas"** na barra de ações do ciclo (`ult-cycle-actions`), ao lado de "Carregar base" e dos controles de atualização. Quando há ofertas na lista, o rótulo exibe o contador: **"Ofertas excluídas (2)"**.

- `gestor`: vê o botão e gerencia a lista.
- `analista`: vê o botão e a lista em **modo leitura** (sem seletor nem remover), espelhando o gate real dos endpoints.
- `comum`: sem acesso ao módulo, como hoje.

### 3.2 Modal "Ofertas excluídas"

Segue o padrão visual e estrutural do `UploadBuyersModal`.

**Adicionar** (só `gestor`):
- Seletor com as ofertas do produto do ciclo, cada opção exibindo `offer_name` · `offer_code` · nº de vendas registradas. Ordenadas por nº de vendas (desc). Ofertas já excluídas não aparecem no seletor.
- Campo de **nota** opcional, texto curto (ex.: "compras da equipe", "cupom 100% de teste").
- Botão "Excluir oferta" adiciona uma oferta por vez.

**Lista das ofertas excluídas:**
- Uma linha por oferta: nome + código, nota, quem excluiu e quando.
- Botão de remover por linha (só `gestor`), devolvendo as vendas à contabilidade.

**Estado vazio:** texto explicando que nenhuma oferta está excluída e que todas as compras do produto contam.

Ao fechar o modal após qualquer alteração, o dashboard recarrega (mesmo `reloadToken` já usado por upload e vínculo).

### 3.3 Sinalização no dashboard

Com a lista não vazia, a seção **"01 Visão do ciclo"** ganha uma linha discreta abaixo do cabeçalho: *"2 ofertas excluídas da contabilidade"*. Com a lista vazia, nada é exibido.

## 4. Regras de negócio

### 4.1 O filtro

Uma venda é **excluída** quando seu `offer_code` está na lista de ofertas excluídas do ciclo. Venda excluída deixa de existir para o dashboard: não é atribuída a ninguém, não classifica ninguém, não entra em nenhuma agregação.

O filtro é aplicado no CTE que monta o universo de vendas, **antes** do `left join` de vínculos manuais e do casamento por email.

### 4.2 Precedência sobre o vínculo manual

**A exclusão vence sempre.** Se uma venda com vínculo manual pertence a uma oferta excluída, ela some do dashboard e o vínculo fica órfão (permanece na tabela, sem efeito). Consequências:

- Excluir uma oferta **não** exige desfazer vínculos antes.
- `POST /api/ultimates/links` passa a **rejeitar** (400) vínculo cuja transação pertença a uma oferta excluída do ciclo — não faz sentido criar um vínculo nascido sem efeito.

### 4.3 Efeitos na classificação

| Situação | Efeito |
|---|---|
| Comprador da base cuja **única** venda era de oferta excluída | Volta a `nao_renovado`. Continua no roster e no denominador "Base" — o CSV da base não muda |
| Comprador da base com outras vendas fora da oferta excluída | Reclassificado só a partir das vendas restantes (`renovado` / `renovacao_reembolsada`), com `renewed_at` e `total_value` recalculados |
| Email fora da base cuja única venda era de oferta excluída | Desaparece do roster e do KPI "Novos Compradores" |
| Venda com `offer_code` nulo | **Nunca** é excluída por este mecanismo — não há como associá-la a uma oferta |

Como KPIs, card Evolução, tabela e exportação CSV derivam das mesmas duas RPCs, todos passam a refletir o filtro automaticamente e continuam batendo entre si.

### 4.4 Ciclo encerrado

Diferente de "Atualizar agora" e do vínculo manual (que retornam 409 em ciclo encerrado), **a lista de ofertas excluídas é editável em qualquer status**. Decisão do owner: uma compra de teste descoberta depois do encerramento também suja o histórico e precisa poder ser corrigida.

### 4.5 Reversibilidade

Remover a oferta da lista devolve todas as suas vendas à contabilidade na leitura seguinte, sem refresh nem reprocessamento — nenhuma venda foi alterada em momento algum.

## 5. Requisitos funcionais

| # | Requisito |
|---|---|
| RF-1 | `gestor` exclui uma oferta do ciclo selecionando-a de uma lista das ofertas reais do produto, com nota opcional |
| RF-2 | A mesma oferta não pode ser excluída duas vezes no mesmo ciclo |
| RF-3 | `gestor` remove uma oferta da lista, revertendo o efeito |
| RF-4 | `analista` visualiza a lista; endpoints de escrita respondem 403 |
| RF-5 | Vendas de ofertas excluídas não entram em KPIs, roster, card Evolução nem exportação CSV |
| RF-6 | A exclusão tem precedência sobre vínculo manual; criar vínculo em transação de oferta excluída é rejeitado |
| RF-7 | O dashboard sinaliza quantas ofertas estão excluídas quando a lista não está vazia |
| RF-8 | A lista é editável mesmo em ciclo encerrado |
| RF-9 | Cada exclusão registra autor, data e nota opcional, exibidos na lista |

## 6. Requisitos técnicos

### 6.1 Persistência — migration `052_ultimates_excluded_offers.sql`

```sql
create table dash_gestao_ultimates_excluded_offers (
  id          uuid        not null default gen_random_uuid() primary key,
  cycle_id    uuid        not null references dash_gestao_ultimates_cycles(id) on delete cascade,
  offer_code  text        not null references dash_gestao_hotmart_offers(offer_code),
  note        text,
  excluded_by uuid        not null,
  created_at  timestamptz not null default now(),
  constraint uq_ultimates_excluded_offers unique (cycle_id, offer_code)
);

create index idx_ultimates_excluded_offers_cycle_id
  on dash_gestao_ultimates_excluded_offers (cycle_id);

alter table dash_gestao_ultimates_excluded_offers enable row level security;
-- Sem policy de select para authenticated: toda leitura do app passa pelo
-- service_role nas rotas /api/ultimates (com gate de papel), no mesmo idioma
-- de dash_gestao_ultimates_buyers e _manual_links (migration 049).
```

A FK para `dash_gestao_hotmart_offers(offer_code)` é segura: `upsertPlaceholderOffers` (`src/lib/services/hotmart.ts`) grava as ofertas **antes** do upsert das vendas — a própria FK de `dash_gestao_hotmart_sales.offer_code` já exige isso. Toda oferta com venda coletada existe na tabela de ofertas.

Nenhum dado existente é alterado; nenhuma coluna nova em tabelas existentes.

### 6.2 RPCs — `create or replace` das duas funções de leitura

Assinaturas e `RETURNS TABLE` **inalterados**, então `create or replace` basta e os grants existentes são preservados (não repetir o `drop` da 051, que só foi necessário por mudança de tipo de retorno).

Em `dash_gestao_ultimates_roster` (CTE `attributed`) e em `dash_gestao_ultimates_daily` (CTE `approved_sales`), acrescentar o CTE de exclusão e a condição:

```sql
excluded as (
  select eo.offer_code
  from public.dash_gestao_ultimates_excluded_offers eo
  where eo.cycle_id = p_cycle_id
),
...
where s.product_id = cyc.product_id
  and (s.offer_code is null or s.offer_code not in (select offer_code from excluded))
```

A condição entra **antes** dos joins de `links` e `buyers` na leitura lógica, garantindo a precedência de 4.2. Como `roster` monta base e novos compradores a partir do mesmo CTE `attributed`, uma única condição cobre as duas categorias.

### 6.3 RPC nova — opções de oferta do ciclo

```sql
dash_gestao_ultimates_offer_options(p_cycle_id uuid)
returns table (offer_code text, offer_name text, sales_count bigint, is_excluded boolean)
```

`security definer`, `search_path` pinado, `grant execute` só para `service_role` — mesmo idioma das RPCs da 050. Agrupa `dash_gestao_hotmart_sales` por `offer_code` dentro do produto do ciclo, faz join com `dash_gestao_hotmart_offers` para o nome e marca as já excluídas. Necessária porque o client Supabase não agrega e porque `dash_gestao_hotmart_sales` não tem policy de select para `authenticated`.

Lista **todas** as ofertas do produto, inclusive `is_active = false` — oferta de teste costuma ser desativada depois. Ordenação por `sales_count desc`.

### 6.4 APIs

Novas rotas no padrão de `/api/ultimates/*` (auth por `requireRole`, escrita via `createSupabaseServiceClient`):

| Rota | Método | Papel | Comportamento |
|---|---|---|---|
| `/api/ultimates/cycles/[id]/excluded-offers` | `GET` | `gestor`, `analista` | Lista as ofertas excluídas do ciclo com nota, autor e data |
| `/api/ultimates/cycles/[id]/excluded-offers` | `POST` | `gestor` | Body `{ offerCode, note? }`. 404 se ciclo não existe; 400 se a oferta não pertence ao produto do ciclo; 409 se já excluída. Grava `excluded_by = userId` |
| `/api/ultimates/cycles/[id]/excluded-offers` | `DELETE` | `gestor` | Body `{ offerCode }`. 404 se não estiver na lista |
| `/api/ultimates/cycles/[id]/offer-options` | `GET` | `gestor`, `analista` | Chama a RPC de 6.3 para alimentar o seletor |

Nenhuma delas checa `status = 'encerrado'` (regra 4.4).

Alteração em `/api/ultimates/links` (`POST`): após validar que a transação pertence ao produto do ciclo, rejeitar com 400 se o `offer_code` da venda estiver na lista de exclusão do ciclo.

### 6.5 Frontend

- `src/components/ultimates/excluded-offers-modal.tsx` (novo), no padrão de `upload-buyers-modal.tsx`.
- `src/components/ultimates/ultimates-dashboard.tsx`: botão com contador na barra de ações, estado do modal, nota na seção "01" e reload após alteração.
- `src/components/ultimates/types.ts`: tipos locais da UI (`ExcludedOffer`, `OfferOption`).
- `src/types/ultimates.ts`: `UltimatesExcludedOfferRecord` e o retorno da RPC de opções, espelhando as colunas da migration.
- Estilos reaproveitados de `src/app/ultimates/ultimates.css` e do tema escuro compartilhado (`src/app/dash-theme.css`) — sem CSS novo de identidade.

## 7. Critérios de aceite

1. `gestor` abre "Ofertas excluídas", seleciona uma oferta da lista (com nome, código e nº de vendas), grava nota e a oferta passa a constar na lista com autor e data.
2. Após excluir uma oferta, os KPIs, o card Evolução, o roster e o CSV exportado deixam de considerar as vendas dela — e continuam batendo entre si.
3. Comprador da base cuja única venda aprovada era da oferta excluída aparece como "Não renovado", **permanecendo** no roster e no denominador "Base".
4. Email de fora da base cuja única venda era da oferta excluída desaparece do KPI "Novos Compradores" e do roster.
5. Venda com `offer_code` nulo continua contando normalmente após qualquer exclusão.
6. Venda com vínculo manual em oferta excluída não conta: o comprador vinculado volta a "Não renovado" e a linha do vínculo permanece na tabela sem efeito.
7. `POST /api/ultimates/links` responde 400 ao tentar vincular transação de oferta excluída.
8. Remover a oferta da lista devolve todas as suas vendas à contabilidade na leitura seguinte, sem "Atualizar agora".
9. Excluir a mesma oferta duas vezes no mesmo ciclo é recusado (409) e a UI não oferece ofertas já excluídas no seletor.
10. Oferta que não pertence ao produto do ciclo é recusada (400).
11. `analista` vê a lista e não vê ações de escrita; `POST`/`DELETE` respondem 403 para `analista`.
12. Ciclo encerrado permite adicionar e remover ofertas da lista (sem 409), diferente de "Atualizar agora" e do vínculo manual.
13. Com lista não vazia, o botão exibe o contador e a seção "01 Visão do ciclo" exibe a nota; com lista vazia, nenhuma das duas aparece.
14. A exclusão é por ciclo: outro ciclo do mesmo produto não é afetado, e os dashboards Hotmart/Indicadores continuam idênticos.

## 8. Riscos e pontos de atenção

- **Número muda sem aviso:** a exclusão altera KPIs já observados e a classificação é derivada em leitura, sem histórico. Mitigado pela sinalização de 3.3 e pelo registro de autor/data/nota — mas quem não abrir o modal só vê o contador.
- **Vínculo manual órfão:** por decisão de 4.2, excluir uma oferta pode deixar vínculos sem efeito, silenciosamente. A remoção da oferta os reativa. Não há tela que liste vínculos órfãos.
- **Ciclo encerrado editável:** rompe deliberadamente a regra "encerrado não muda" aplicada em refresh e vínculos. Decisão registrada do owner; vale documentar no código para não ser "corrigido" depois como inconsistência.
- **Ofertas sem venda:** o seletor lista ofertas do produto mesmo com zero vendas; excluir uma delas não muda nada. Aceitável — o nº de vendas na opção deixa isso explícito.
- **Performance:** um `not in` sobre uma lista de poucas linhas por ciclo, dentro do universo já restrito por `product_id`. Impacto desprezível; o índice `idx_hotmart_sales_product_buyer_email` segue sendo o que sustenta o join.
- **Cobertura de teste:** o efeito real da exclusão vive em SQL, que os testes Jest do repo não executam. Os testes cobrem rotas e UI com mocks; a validação da classificação filtrada precisa ser manual, com dados reais, junto da aplicação da migration.

## 9. Decisões registradas (entrevista de 2026-07-30)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Problema a resolver | Compras de teste/interno inflando os números do ciclo |
| 2 | Modelo | **Blacklist** de ofertas (whitelist rejeitada: manutenção maior que o problema) |
| 3 | Escopo da lista | **Por ciclo** |
| 4 | Exclusão × vínculo manual | **Exclusão vence sempre**; vínculo em oferta excluída passa a ser rejeitado |
| 5 | Entrada do código | **Seletor** das ofertas reais do produto (código + nome + nº de vendas), não campo de texto |
| 6 | Local na UI | **Botão + modal próprio**, ao lado de "Carregar base" |
| 7 | Transparência | **Badge no botão + nota** no card "01 Visão do ciclo" |
| 8 | Ciclo encerrado | **Permitir sempre** (diverge de refresh e vínculo manual, que bloqueiam) |
| 9 | Auditoria | **Quem, quando e nota opcional** |
| 10 | Coleta Hotmart | **Intocada** — filtro só em leitura, exclusão totalmente reversível |
