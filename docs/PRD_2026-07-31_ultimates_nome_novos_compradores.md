# PRD — Dash Ultimates: nome e telefone dos novos compradores

**Date:** 2026-07-31
**Status:** Approved (decisões validadas em entrevista com o owner)
**Owner:** Alberani
**Depende de:** Dash Ultimates (issue #114) — migrations 049–055 e rotas `/api/ultimates/*`

## 1. Contexto e problema

O roster do ciclo mistura dois tipos de linha. As da **base** vêm do CSV importado (`dash_gestao_ultimates_buyers`) e trazem nome, email e telefone. As de **novo comprador** são derivadas das vendas Hotmart de emails que não estão na base — e trazem **só o email**. Na tabela, nome e telefone dessas linhas aparecem como `—`.

Isso não é uma escolha de produto, é uma perda de dado na coleta. A API `sales/history` da Hotmart **devolve** o nome do comprador (`HotmartSaleItem.buyer` já é tipado como `{ email: string; name?: string }` em `src/lib/services/hotmart.ts:32`), mas `mapHotmartSaleItem` grava apenas `buyer_email` e descarta o resto. A migration 050 já documentava o efeito colateral:

> *"NÃO existe coluna `buyer_name` na tabela (o coletor grava apenas `buyer_email`; `item.buyer.name` da API NÃO é persistido)"*

Como a coluna não existe, a RPC `dash_gestao_ultimates_roster` não tem de onde tirar o nome e emite literalmente `null::text as name` para toda linha de novo comprador (migration 055, linha 226).

**Consequência prática:** o gestor vê "8 novos compradores" no KPI e uma lista de oito emails. Não consegue reconhecer ninguém, não consegue decidir se aquilo é uma pessoa nova de verdade ou alguém da base que comprou com outro email — que é exatamente a decisão que o vínculo manual existe para registrar. O nome é o dado que torna essa decisão possível.

**Objetivo:** persistir o nome (e, quando disponível, o telefone) que a Hotmart já envia, e exibi-los nas linhas de novo comprador do roster.

**Princípio de arquitetura (herdado do módulo):** a classificação continua **derivada em leitura**. Esta feature não cria categoria, não grava classificação e não cria cron. Ela só deixa de jogar fora um campo que já chega em cada payload.

## 2. Escopo

### Incluído

- Colunas `buyer_name` e `buyer_phone` em `dash_gestao_hotmart_sales` (migration **056**), ambas `text null`.
- `mapHotmartSaleItem` passa a gravar `buyer_name` — o que alimenta os **três** caminhos que já escrevem nessa tabela (cron diário, cron semanal, "Atualizar agora").
- Passo aditivo do webhook passa a gravar `buyer_name` e `buyer_phone` quando o payload os trouxer.
- `dash_gestao_ultimates_roster` passa a preencher `name` e `phone` nas linhas de novo comprador, agregados por email.
- Nada de UI nova: `RosterTable`, `RosterCards`, a busca e o export CSV já consomem `row.name` e `row.phone`.

### Fora de escopo

| Item | Motivo |
|---|---|
| Fallback do nome da Hotmart em linhas da **base** | O CSV é a fonte da verdade da base, e o nome é editável pelo gestor (PR #145). Um `coalesce` faria a coluna Nome ter duas procedências sem sinalização, e só ajudaria quem já renovou — linha sem venda não tem nome na Hotmart para buscar |
| Tela ou export dedicado de "novos compradores" | O roster já filtra por categoria e exporta CSV; a lista pedida é a tabela existente com a coluna preenchida |
| Criar linha em `dash_gestao_ultimates_buyers` para o novo comprador | Romperia "classificação derivada em leitura" e seria apagado pelo próximo `replace_buyers` |
| Rota/script de backfill dedicado | "Atualizar agora" (janela `created_at` → agora) e o cron semanal (60 dias) já reescrevem as linhas via `upsert onConflict: transaction_code`. Código novo de uso único contraria o princípio de peso marginal zero |
| Liberar refresh em ciclo encerrado para backfillar histórico | Reverteria o 409 deliberado em ciclo encerrado |
| Title-case / normalização cosmética do nome | Erra em nomes compostos, preposições e siglas, e faria o CSV exportado divergir do banco |
| Restringir `select("*")` de `/api/hotmart/sales` | A rota já devolve `buyer_email` para a mesma audiência; apertá-la é mudança de comportamento em rota compartilhada, com risco de quebrar consumidores em silêncio |

## 3. Experiência do usuário

Nenhum componente novo, nenhum botão novo, nenhum CSS novo.

| Onde | Antes | Depois |
|---|---|---|
| Coluna "Nome" da linha de novo comprador | `—` | Nome vindo da Hotmart (ou `—` se ela não mandou) |
| Coluna "Telefone" da linha de novo comprador | `—` | Telefone (apenas para compras recebidas via webhook após o deploy) |
| Card do mobile (`RosterCards`) | Título `—` sobre o email | Título com o nome sobre o email |
| Busca do roster | Só achava novo comprador por email | Acha por nome também (`table-filter.ts:23` já filtra `row.name`) |
| Export CSV | Coluna de nome vazia nessas linhas | Preenchida, com a mesma neutralização anti-CSV-injection já aplicada |

O nome aparece **nos dois modos do switch**. Com `counts_new_buyers = false` a linha vira "renovação sem vínculo" e mantém nome e telefone: `applyNewPurchasesModeToRoster` só reescreve `category` (`new-purchases-mode.ts:31`), então o dado atravessa sem código adicional. É também o momento em que o nome mais importa — é ele que permite reconhecer de quem é aquele email e criar o vínculo manual.

## 4. Regras de negócio

### 4.1 Origem de cada campo

| Campo | Fonte | Caminhos que gravam |
|---|---|---|
| `buyer_name` | `item.buyer.name` (API `sales/history`) e `data.buyer.name` (webhook) | Cron diário (3 dias), cron semanal (60 dias), "Atualizar agora", webhook |
| `buyer_phone` | `data.buyer.checkout_phone` (webhook) | **Somente o webhook** |

A assimetria é da Hotmart, não uma escolha: a API `sales/history` não devolve telefone. O efeito está registrado em 8 (Riscos).

### 4.2 Gravação crua, com `trim`

Valor é gravado como veio, apenas com `trim`; string vazia vira `null`. Mesmo idioma de `buyer_email`, que é gravado cru e só normalizado na leitura, dentro das RPCs.

### 4.3 Campo ausente nunca vira `null` no payload de escrita

Regra que vale para os dois campos e para todos os escritores: quando a Hotmart não manda o valor, a **chave é omitida do objeto** enviado ao PostgREST — nunca enviada como `null`.

O `upsert ... onConflict: transaction_code` do PostgREST só atualiza as colunas presentes no payload. Enviar `buyer_name: null` num evento de estorno apagaria o nome que o cron já tinha gravado. Omitir preserva.

### 4.4 `mapHotmartSaleItem` **não** pode conter `buyer_phone`

Consequência direta de 4.1 + 4.3, e o ponto mais frágil da feature. `mapHotmartSaleItem` alimenta os dois crons e o refresh, e **não tem telefone para dar**. Se essa chave for adicionada ali — mesmo como `null`, mesmo "por consistência" —, o cron semanal apaga todos os telefones gravados pelo webhook, silenciosamente, uma vez por semana.

A proteção é uma **ausência**, e ausências não se defendem sozinhas. Por isso: comentário explícito na função **e um teste que falha se a chave reaparecer**.

### 4.5 Qual nome ganha quando o email tem várias vendas

`new_sales_agg` agrupa por email normalizado — uma pessoa com duas compras é uma linha só. A regra é: **primeiro valor não-nulo entre TODAS as vendas daquele email**, na mesma ordenação usada para `transaction_code` (`approved_date asc nulls last`, desempatada por `transaction_code` para ser determinística).

Duas propriedades importantes:

- **Sem filtro por status.** Os demais campos da linha (`renewed_at`, `total_value`, `transaction_code`) são filtrados por vendas aprovadas. Nome e telefone **não podem ser** — a categoria `novo_reembolsado` não tem nenhuma venda aprovada por definição, e filtrar deixaria essas linhas com `—` para sempre.
- No caso comum o valor é o da própria venda exibida; só diverge quando ela chegou sem o campo e outra compra do mesmo email o tem.

### 4.6 Linhas da base não mudam

`base_roster` continua tirando `name` e `phone` de `dash_gestao_ultimates_buyers`. Nenhum `coalesce`, nenhuma mistura de procedência: base = CSV (editável pelo gestor, sobrescrito pelo próximo upload), novo comprador = Hotmart.

### 4.7 Preenchimento retroativo

Nenhum mecanismo novo. As três rotas de coleta fazem `upsert onConflict: transaction_code`, então reescrevem a linha existente e preenchem o nome retroativamente dentro das respectivas janelas:

| Caminho | Janela | Efeito |
|---|---|---|
| "Atualizar agora" | `cycle.created_at` → agora (`refresh/route.ts:154`) | Preenche o ciclo ativo inteiro em um clique |
| Cron semanal | 60 dias (`cron/hotmart/weekly/route.ts:32`) | Preenche o resto sozinho, sem ação humana |
| Cron diário | 3 dias (`sync-platform.ts:9`) | Cobre o fluxo corrente |

Venda com mais de 60 dias em ciclo encerrado não é alcançada por nenhum deles (refresh responde 409 em ciclo encerrado) e permanece sem nome. Limitação aceita.

## 5. Requisitos funcionais

| # | Requisito |
|---|---|
| RF-1 | Toda venda coletada da Hotmart persiste o nome do comprador, quando a Hotmart o envia |
| RF-2 | A linha de novo comprador do roster exibe esse nome no lugar de `—` |
| RF-3 | A linha de "Novo — reembolsado" também exibe o nome, apesar de não ter venda aprovada |
| RF-4 | O nome aparece com o switch "Novas Compras" ligado **e** desligado |
| RF-5 | O telefone é persistido quando o webhook o envia, e exibido na linha de novo comprador |
| RF-6 | O passo aditivo do webhook continua à prova de falha: ausência dos campos novos, ou erro ao gravá-los, não altera a resposta HTTP nem o fluxo existente |
| RF-7 | Um evento de webhook sem nome (ex.: estorno) **não** apaga o nome já gravado |
| RF-8 | O cron não apaga o telefone gravado pelo webhook |
| RF-9 | Um clique em "Atualizar agora" preenche o nome das vendas já coletadas do ciclo ativo |
| RF-10 | A busca do roster encontra novo comprador pelo nome; o CSV exportado o inclui |
| RF-11 | Linhas da base continuam exibindo o nome do CSV, sem interferência do nome da Hotmart |

## 6. Requisitos técnicos

### 6.1 Persistência — migration `056_hotmart_sales_buyer_identity.sql`

```sql
-- UP
alter table dash_gestao_hotmart_sales
  add column buyer_name  text,
  add column buyer_phone text;
```

Duas colunas nullable, sem default, sem índice — nenhum filtro ou join usa esses campos. Nenhuma linha existente é alterada; nenhuma RLS muda.

`buyer_phone` fica separada de `buyer_name` de propósito, e não num JSONB único: têm ciclos de escrita diferentes (4.1) e a regra de 4.4 depende de ser possível omitir uma sem a outra.

### 6.2 RPC — `dash_gestao_ultimates_roster`

`RETURNS TABLE` **não muda** (`name` e `phone` já estão na assinatura). Logo `create or replace` basta e **os grants sobrevivem** — nada de `DROP`, ao contrário do que a 051 e a 055 precisaram fazer.

Três alterações, todas dentro da função:

**(a) CTE `attributed`** passa a carregar os campos, já normalizando vazio para `null` na leitura:

```sql
nullif(btrim(s.buyer_name), '')  as buyer_name,
nullif(btrim(s.buyer_phone), '') as buyer_phone,
```

**(b) CTE `new_sales_agg`** agrega pela regra 4.5 — sem `filter` de status, com ordenação determinística:

```sql
(array_agg(a.buyer_name  order by a.approved_date asc nulls last, a.transaction_code)
   filter (where a.buyer_name is not null))[1]  as name,
(array_agg(a.buyer_phone order by a.approved_date asc nulls last, a.transaction_code)
   filter (where a.buyer_phone is not null))[1] as phone,
```

**(c) CTE `new_roster`** troca os literais por esses valores:

```sql
-- antes: null::text as name, null::text as phone
nsa.name  as name,
nsa.phone as phone,
```

`base_roster` fica **intacta** (4.6). `dash_gestao_ultimates_daily` e `dash_gestao_ultimates_hourly` **não são tocadas** — não expõem identidade.

⚠️ **Ordem obrigatória de aplicação: 052 → 055 → 056.** O corpo da `_roster` da 056 é o da 055 (com os CTEs `excluded_buyers`/`excluded_links` e `from_manual_link`) e referencia `dash_gestao_ultimates_excluded_buyers`. O Postgres valida o corpo na criação: aplicar a 056 antes da 055 falha.

### 6.3 Escritores

**`src/lib/services/hotmart.ts` — `mapHotmartSaleItem`:**

```ts
buyer_name: item.buyer.name?.trim() || null,
// buyer_phone NÃO entra aqui — ver 4.4. A API sales/history não devolve
// telefone; incluir a chave (mesmo como null) faria o cron apagar
// semanalmente o telefone gravado pelo webhook.
```

Alimenta simultaneamente `collectHotmart` (os dois crons) e o "Atualizar agora", que compartilham essa função.

**`src/app/api/hotmart/webhook/route.ts` — passo aditivo:** o tipo local do payload ganha `name` e `checkout_phone` em `buyer`, e o objeto do upsert ganha as duas chaves **condicionalmente** (regra 4.3):

```ts
...(buyerName  ? { buyer_name:  buyerName  } : {}),
...(buyerPhone ? { buyer_phone: buyerPhone } : {}),
```

O bloco continua dentro do `try/catch` existente; nada na resposta HTTP muda.

**Nada mais muda.** `src/types/ultimates.ts` já declara `name: string | null` e `phone: string | null` em `UltimatesRosterRow`; `RosterTable`, `RosterCards`, `filterRosterRows` e o export CSV já consomem os dois campos.

### 6.4 Testes

| Teste | Protege |
|---|---|
| `mapHotmartSaleItem` grava `buyer_name` trimado; nome vazio ou ausente vira `null` | RF-1 |
| **`mapHotmartSaleItem` não emite a chave `buyer_phone`** | RF-8 / regra 4.4 — é o teste-guarda contra a regressão silenciosa |
| Webhook com nome e telefone no payload inclui as duas chaves no upsert | RF-5 |
| Webhook sem esses campos **omite as chaves** (não envia `null`) | RF-7 |
| Webhook com payload novo continua respondendo 200 e não altera o fluxo existente | RF-6 |
| `RosterTable` renderiza o nome numa linha `novo_comprador` (`buyer_id = null`) | RF-2 |
| `applyNewPurchasesModeToRoster` preserva `name`/`phone` ao reescrever a categoria | RF-4 |

O comportamento da agregação (4.5) vive em SQL e o Jest do repo não o executa — vai para a validação manual (7.1).

## 7. Critérios de aceite

1. Uma venda nova coletada da Hotmart persiste `buyer_name` em `dash_gestao_hotmart_sales`.
2. A linha de novo comprador do roster exibe o nome; a busca do roster o encontra por nome; o CSV exportado o traz.
3. A linha de "Novo — reembolsado" (sem venda aprovada) também exibe o nome.
4. Desligar o switch "Novas Compras" reclassifica a linha para "renovação sem vínculo" **mantendo** nome e telefone.
5. Linha da base continua com o nome do CSV, mesmo quando a Hotmart tem outro nome para o mesmo email.
6. Um clique em "Atualizar agora" num ciclo com novos compradores antigos preenche os nomes deles.
7. Um webhook de estorno (payload sem nome) **não** apaga o nome já gravado da mesma transação.
8. Após um ciclo do cron semanal, o telefone gravado pelo webhook **continua lá**.
9. Comprador com duas compras aparece com um único nome, e ele não muda entre dois refreshes sem que nada tenha mudado na Hotmart.
10. Venda cujo nome a Hotmart não enviou continua exibindo `—`, sem quebrar a linha.
11. Nenhum outro dashboard muda: Indicadores, Hotmart e Convite continuam idênticos.

### 7.1 Validação manual (o que o Jest não cobre)

Depende da fila de migrations subir (052 → 055 → 056):

- Critérios 3, 5, 6 e 9 — vivem na agregação SQL da `_roster`.
- Critérios 7 e 8 — exigem observar dois eventos reais separados no tempo.
- **Premissa a confirmar no primeiro webhook real:** que `data.buyer.name` e `data.buyer.checkout_phone` existem no payload v2 da Hotmart. O código é defensivo (campo ausente = chave omitida), então a premissa errada degrada para "telefone nunca preenchido", não para erro.

## 8. Riscos e pontos de atenção

- **A proteção do telefone é uma ausência.** Regra 4.4. Um `buyer_phone: null` adicionado a `mapHotmartSaleItem` por bom senso aparente apaga a coluna inteira no cron seguinte, sem erro e sem log. Mitigado por comentário na função e teste-guarda, que é o que efetivamente falha se alguém tentar.
- **Telefone nasce e permanece irregular.** Só existe para compras que passaram pelo webhook depois do deploy. Os novos compradores já existentes ficam com `—` para sempre — não há backfill possível, porque a API de vendas não devolve telefone. A coluna vai parecer meio quebrada, e é esperado.
- **Nome só aparece depois de uma coleta.** Aplicar a migration não preenche nada: a coluna nasce vazia. Até um "Atualizar agora" ou o próximo cron semanal, o roster segue exibindo `—`.
- **Histórico antigo fica sem nome.** Venda com mais de 60 dias em ciclo encerrado não é alcançada por nenhuma janela de coleta.
- **Toque em código compartilhado.** É a primeira feature do Ultimates a alterar `dash_gestao_hotmart_sales` e `mapHotmartSaleItem`, usados por Indicadores, Convite, Funis e LTV. O toque é estritamente aditivo (duas colunas nullable, uma chave a mais no objeto mapeado) e nenhum consumidor atual seleciona colunas por posição — mas o princípio "peso marginal zero" do PRD original fica formalmente flexibilizado aqui, com esta justificativa: o dado só pode vir do coletor.
- **PII em rota compartilhada.** `/api/hotmart/sales` faz `select("*")` sob `validateApiAuth()` (`route.ts:6,24`), então nome e telefone passam a sair por ali. Aceito: a mesma rota já devolve `buyer_email`, que é mais identificável.
- **Degradação enquanto a migration não sobe.** Sem a 056, a RPC antiga segue devolvendo `null` e a UI segue mostrando `—`. Degrada sozinha, sem código de compatibilidade — diferente do caso de `from_manual_link`, porque `name` e `phone` já fazem parte do contrato do tipo.
- **Fila de migrations.** 052 e 055 continuam pendentes no Supabase deste ambiente. A 056 entra atrás delas e **não pode** ser aplicada antes da 055 (6.2).

## 9. Decisões registradas (entrevista de 2026-07-31)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Entregável | **Preencher as colunas do roster existente**; sem tela nova nem export dedicado |
| 2 | Onde o dado mora | **Colunas em `dash_gestao_hotmart_sales`** — única opção alimentada pelos três caminhos de coleta, inclusive o cron que deve seguir intocado |
| 3 | Caminho tempo-real | **Webhook grava se vier**; ausente, o cron/refresh corrige depois. Sem chamada externa nova no webhook |
| 4 | Escopo do nome | **Só linhas de novo comprador**; sem fallback na base |
| 5 | Switch "Novas Compras" desligado | **Nome continua aparecendo** nos dois modos |
| 6 | Email com várias vendas | **Primeiro não-nulo entre todas as vendas**, sem filtrar por status — é o que dá nome a "Novo — reembolsado" |
| 7 | Normalização | **Só `trim`**; vazio vira `null`. Sem title-case |
| 8 | Backfill | **Nenhum código novo**: refresh do ciclo + cron semanal de 60 dias |
| 9 | PII em `/api/hotmart/sales` | **Aceitar**: a rota já devolve `buyer_email` |
| 10 | Telefone | **Incluído**, aceitando explicitamente que o preenchimento será parcial e sem backfill |
| 11 | Proteção do telefone contra o cron | **Omitir `buyer_phone` de `mapHotmartSaleItem`**, com comentário e teste-guarda |
| 12 | Entrega | **PRD como issue**, depois branch de implementação |
