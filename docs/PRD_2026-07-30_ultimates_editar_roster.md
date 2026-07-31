# PRD — Dash Ultimates: editar o roster do ciclo

**Date:** 2026-07-30
**Status:** Approved (decisões validadas em entrevista com o owner)
**Owner:** Alberani
**Depende de:** Dash Ultimates (issue #114) — migrations 049–054 e rotas `/api/ultimates/*`

## 1. Contexto e problema

O roster do ciclo é a lista de todo mundo que o dashboard conhece: os compradores da base (importados por CSV em `dash_gestao_ultimates_buyers`) e os emails que compraram sem estar na base. Ele **não tem registros editáveis** — é derivado em leitura pela RPC `dash_gestao_ultimates_roster`, cruzando a base com as vendas Hotmart do produto do ciclo.

Três situações concretas travam o gestor hoje:

1. **Lixo na base afunda a meta.** A base importada carrega emails de teste, internos e duplicados. Eles nunca renovam, entram no denominador do % de renovação (`base` em `kpi-aggregation.ts`) e afundam exatamente o número que o dashboard existe para responder. A única saída atual é editar a planilha e refazer o upload inteiro.
2. **Classificação errada sem caminho de correção.** Quando alguém renova com outro email, aparece como "não renovado" de um lado e como "novo comprador" do outro. O vínculo manual resolve — mas só existe partindo da linha do **novo comprador**. Olhando para "Fulano — não renovado", não há ação nenhuma.
3. **Dado errado no cadastro.** Nome ou telefone vieram errados do CSV e a correção exige refazer o upload da base inteira.

**Objetivo:** dar ao gestor três ações na própria linha do roster — **excluir** um lead da contabilidade, **marcar como renovado** apontando a compra correspondente, e **corrigir** nome e telefone.

**Princípio de arquitetura (herdado do módulo):** a classificação do Ultimates é **derivada em leitura**, nunca armazenada. Nenhuma ação deste PRD grava categoria. "Excluir" é um filtro aplicado dentro das RPCs (mesmo mecanismo da exclusão de ofertas, migration 052) e "marcar como renovado" é o vínculo manual que já existe, entrado pelo outro lado. Todo "renovado" continua tendo uma venda Hotmart real por trás, com data, valor e `transaction_code`.

## 2. Escopo

### Incluído

- Nova tabela `dash_gestao_ultimates_excluded_buyers`: leads excluídos da contabilidade **por ciclo**, chaveados por **email normalizado**, com autoria e nota opcional.
- Filtro de leads excluídos nas **três** RPCs de leitura (`roster`, `daily`, `hourly`), aplicado nos **dois lados**: fora da base e fora do universo de vendas.
- Rotas de gestão da lista (`GET`/`POST`/`DELETE`) e rota nova de edição de cadastro (`PATCH`).
- Coluna de ações no roster com até três botões por linha da base, e as ações equivalentes nos cards do mobile.
- Modal "Leads excluídos" (lista + restaurar) acionado por botão com contador na barra de ações do ciclo.
- Sinalização no tile **Base** de quantos leads estão excluídos.
- Novo campo `from_manual_link` no retorno do roster, que faz "Desfazer vínculo" aparecer apenas quando existe vínculo a desfazer.

### Fora de escopo

| Item | Motivo |
|---|---|
| Override livre de categoria ("marcar renovado" sem venda) | Rejeitado na entrevista: quebraria a invariante "classificação derivada em leitura", produziria linha sem data/valor/transação e faria a tabela divergir do card Evolução, que vem das vendas |
| Forçar renovação casada-por-email a virar "novo comprador" | Exigiria tabela e filtro novos nas três RPCs; com `counts_new_buyers = false` a ação nem move o % da meta (`renovados = renovadosBase + renovacoesSemVinculo`). "Desfazer vínculo" já cobre o caso reversível |
| Excluir venda avulsa por `transaction_code` | A dor é a base, não a venda. Compra de teste com oferta própria já é resolvida pelo PRD de ofertas excluídas (#139) |
| Excluir linha de "novo comprador" (`buyer_id = null`) | Manteria a promessa "isto edita a base" e evita reintroduzir pela porta dos fundos a exclusão de venda. Novo comprador não entra no denominador da meta |
| Editar o `email` do lead | É a chave do cruzamento e do unique `uq_ultimates_buyers_cycle_email`: trocá-lo reclassifica a pessoa sem deixar rastro do motivo. O vínculo invertido cobre o caso legítimo de forma explícita e auditável |
| Seleção múltipla / exclusão em lote | Exigiria adicionar seleção ao `DataTable` compartilhado (usado por outros dashes) e replicar nos cards do mobile. O volume real é baixo, e excluir vendo quem é a pessoa é justamente o que evita excluir a errada |
| Denylist global entre ciclos | Excluir alguém hoje reescreveria silenciosamente o % de ciclos já encerrados. Escopo por ciclo, como todo o resto do módulo |
| Proteger a edição manual do próximo upload | O CSV continua sendo a fonte da verdade; o modal avisa que a correção vale até o próximo upload |

## 3. Experiência do usuário

### 3.1 Ações na linha do roster

A coluna "Ação" do `RosterTable` (hoje com no máximo um botão) passa a ser **"Ações"**, com rótulos curtos no mesmo `btn-secondary` já usado. Visíveis apenas para `gestor` — `analista` continua vendo a tabela sem coluna de ações.

| Tipo de linha | Botões |
|---|---|
| Base, `nao_renovado` | `Marcar renovado` · `Editar` · `Excluir` |
| Base, `renovado` / `renovacao_reembolsada` **com** vínculo manual | `Desfazer vínculo` · `Editar` · `Excluir` |
| Base, `renovado` / `renovacao_reembolsada` **sem** vínculo manual | `Editar` · `Excluir` |
| Novo comprador / renovação sem vínculo (`buyer_id = null`) | `Vincular à base` (inalterado) |

Em **ciclo encerrado**, sobra apenas `Excluir` (ver 4.5).

No mobile (< 640px), os mesmos botões entram no rodapé do card em `RosterCards`, empilhados full-width, com os mesmos `data-testid`.

### 3.2 Modal "Excluir lead"

Confirmação com o contexto que evita o erro: nome, email, categoria atual e — quando existe — **data e valor da compra que será descartada junto**. Campo de nota opcional.

Texto quando a pessoa tem compra aprovada: *"Esta pessoa tem uma renovação de R$ X em dd/mm. Excluí-la remove também essa compra da contabilidade do ciclo."*

### 3.3 Modal "Marcar como renovado" (vínculo invertido)

Espelho do `LinkBuyerModal`, com os dois lados trocados: parte do comprador da base e escolhe **a compra**.

- Lista de candidatas: as compras não atribuídas do ciclo — exatamente as linhas do roster com `buyer_id = null`, já em memória no dashboard. Cada opção exibe email, data e valor. Busca por email.
- Sem candidatas, o botão fica **desabilitado** com título explicativo ("Nenhuma compra sem atribuição neste ciclo").
- Confirmação em duas etapas, como no `LinkBuyerModal`: escolher → confirmar → `POST /api/ultimates/links`.
- Com `counts_new_buyers = false` as mesmas linhas se chamam "renovação sem vínculo"; o texto do modal acompanha a nomenclatura do ciclo.

### 3.4 Modal "Editar lead"

Dois campos: **nome** e **telefone**. O email é exibido, não editável, com explicação de uma linha. Aviso fixo no rodapé: *"Esta correção vale até o próximo upload da base."*

### 3.5 Modal "Leads excluídos"

Botão **"Leads excluídos"** na barra de ações do ciclo (`ult-cycle-actions`), ao lado de "Ofertas excluídas". Com lista não vazia, exibe o contador: **"Leads excluídos (3)"**.

- `gestor`: gerencia (restaurar).
- `analista`: vê a lista em modo leitura, espelhando o gate dos endpoints.

Uma linha por lead: nome (resolvido na base do ciclo, quando ainda existe lá), email, nota, quem excluiu e quando, com botão **Restaurar**. Estado vazio explica que nenhum lead está excluído.

Segue o padrão estrutural e visual do `ExcludedOffersModal`, inclusive o `onChanged` que dispara o `reloadToken` do dashboard.

### 3.6 Sinalização nos KPIs

Com a lista não vazia, o tile **Base** ganha o subtítulo `3 excluídos` (o `sub` que o `KpiTile` já suporta). É onde o número mudou — o botão do cabeçalho sozinho deixaria o tile mentindo por omissão para quem só bate o olho nos KPIs.

## 4. Regras de negócio

### 4.1 O que "excluir um lead" significa

O email normalizado do lead entra na lista de excluídos do ciclo. A partir daí, para aquele ciclo, **ele deixa de existir dos dois lados**:

- não aparece no roster nem entra em `base` (denominador do % de renovação);
- suas vendas saem do universo de vendas antes de qualquer atribuição — não viram renovação, não viram novo comprador, não entram nas curvas `daily`/`hourly`.

A decisão de remover as vendas junto é deliberada: sem ela, tirar alguém da base faria a compra dele reaparecer como "novo comprador", e o % da meta subiria por dois lados ao mesmo tempo.

Nenhuma linha de `dash_gestao_ultimates_buyers` é apagada e nenhuma venda é alterada. É filtro em leitura, integralmente reversível.

### 4.2 Chave por email, não por `buyer_id`

A lista é chaveada pelo **email normalizado** (`lower(btrim(...))`), por duas razões:

1. É por email que o lado das vendas é filtrado — `dash_gestao_hotmart_sales` só tem `buyer_email`.
2. `dash_gestao_ultimates_replace_buyers` (migration 050) apaga e reinsere quem sai e volta ao CSV, gerando `id` novo. Uma exclusão chaveada por `buyer_id` seria perdida silenciosamente; chaveada por email, ela **sobrevive ao re-upload** — se o email voltar na planilha, continua excluído.

### 4.3 Exclusão vence o vínculo manual

Mesma precedência já adotada para ofertas excluídas (PRD #139, decisão 4). Uma venda vinculada manualmente a um lead excluído **também** sai da contabilidade, mesmo que o email da venda não esteja na lista. O vínculo permanece na tabela sem efeito e volta a valer se o lead for restaurado.

Sem essa regra, a venda escaparia do filtro por email, continuaria atribuída na CTE `links` e apareceria como renovação nas curvas `daily`/`hourly` — enquanto sumiria do roster, cujo join com a base não a encontraria. Tabela e gráfico divergiriam.

### 4.4 Efeitos na classificação

| Situação | Efeito |
|---|---|
| Lead excluído sem nenhuma venda | Some do roster; `base` cai 1; `naoRenovados` cai 1; o % da meta **sobe** |
| Lead excluído com renovação aprovada | Some do roster **e** a venda some da contabilidade; `base` cai 1, `renovados` cai 1; a receita dele sai das curvas |
| Lead excluído com vínculo manual | Idem, por 4.3; o vínculo fica órfão |
| Lead restaurado | Volta inteiro na leitura seguinte, com vendas e vínculos, sem refresh |
| Linha de novo comprador | Não é afetada — não há ação de exclusão nela |

Como KPIs, card Evolução, tabela e exportação CSV derivam das mesmas três RPCs, todos refletem o filtro automaticamente e continuam batendo entre si.

### 4.5 Ciclo encerrado

Regra por natureza da ação, não uniforme:

| Ação | Ciclo encerrado |
|---|---|
| Excluir / restaurar lead | **Permitido.** É correção de contabilidade, mesmo racional de `excluded-offers` (`route.ts:16`): um email de teste descoberto depois do encerramento também suja o histórico |
| Marcar como renovado (vínculo) | **Bloqueado (409).** `POST /api/ultimates/links` já bloqueia hoje; nada muda |
| Editar nome/telefone | **Bloqueado (409).** Cadastro é operação de ciclo vivo |

Na prática, a linha do roster de um ciclo encerrado mostra apenas `Excluir`.

### 4.6 Edição de cadastro × upload de CSV

`dash_gestao_ultimates_replace_buyers` faz `set name = nr.name, phone = nr.phone, extra = nr.extra` para todo email mantido (migration 050, linha 281). A correção manual **será sobrescrita** no próximo upload da base. O comportamento é mantido (o CSV é a fonte da verdade) e o modal avisa explicitamente.

O `PATCH` não toca `email` nem `extra`.

## 5. Requisitos funcionais

| # | Requisito |
|---|---|
| RF-1 | `gestor` exclui um lead da base a partir da linha do roster, com nota opcional |
| RF-2 | O mesmo email não pode ser excluído duas vezes no mesmo ciclo |
| RF-3 | `gestor` restaura um lead pelo modal "Leads excluídos", revertendo o efeito na leitura seguinte |
| RF-4 | Lead excluído sai do roster, dos KPIs, do card Evolução e do CSV exportado — e suas vendas saem junto |
| RF-5 | A exclusão sobrevive a um novo upload da base que contenha o mesmo email |
| RF-6 | A exclusão vence o vínculo manual: venda vinculada a lead excluído não conta |
| RF-7 | `gestor` marca um lead "não renovado" como renovado escolhendo uma compra não atribuída do ciclo; a linha passa a exibir data, valor e transação reais |
| RF-8 | Sem compras não atribuídas no ciclo, a ação "Marcar renovado" fica indisponível com explicação |
| RF-9 | `gestor` corrige nome e telefone de um lead da base sem refazer o upload; o email não é editável |
| RF-10 | "Desfazer vínculo" só aparece em linha que veio de vínculo manual |
| RF-11 | `analista` vê a lista de excluídos e nenhuma ação de escrita; endpoints de escrita respondem 403 |
| RF-12 | Em ciclo encerrado, excluir/restaurar funciona; marcar renovado e editar cadastro respondem 409 |
| RF-13 | O tile "Base" exibe quantos leads estão excluídos, e o botão do cabeçalho exibe o contador |
| RF-14 | Cada exclusão registra autor, data e nota opcional, exibidos no modal |

## 6. Requisitos técnicos

### 6.1 Persistência — migration `055_ultimates_excluded_buyers.sql`

```sql
create table dash_gestao_ultimates_excluded_buyers (
  id          uuid        not null default gen_random_uuid() primary key,
  cycle_id    uuid        not null references dash_gestao_ultimates_cycles(id) on delete cascade,
  -- SEMPRE normalizado (lower(btrim(...))) na escrita: é a mesma expressão do
  -- join das RPCs e do unique de dash_gestao_ultimates_buyers. NÃO é FK para
  -- buyers — ver 4.2: a chave precisa sobreviver ao delete+reinsert do
  -- replace_buyers e alcançar o lado das vendas, que só tem buyer_email.
  email       text        not null,
  note        text,
  excluded_by uuid        not null,
  created_at  timestamptz not null default now(),
  constraint uq_ultimates_excluded_buyers unique (cycle_id, email)
);

create index idx_ultimates_excluded_buyers_cycle_id
  on dash_gestao_ultimates_excluded_buyers (cycle_id);

alter table dash_gestao_ultimates_excluded_buyers enable row level security;
-- Sem policy de select para authenticated: a tabela contém emails de pessoas
-- reais e toda leitura do app passa pelo service_role nas rotas /api/ultimates
-- (com gate de papel), no mesmo idioma de _buyers e _manual_links (049).
```

Nenhum dado existente é alterado; nenhuma coluna nova em tabelas existentes.

### 6.2 RPCs — filtro de leads excluídos nas três funções de leitura

Dois CTEs novos, idênticos nas três:

```sql
excluded_buyers as (
  select eb.email
  from public.dash_gestao_ultimates_excluded_buyers eb
  where eb.cycle_id = p_cycle_id
),
-- Transações vinculadas manualmente a um lead excluído (regra 4.3). Sem isto,
-- a venda escaparia do filtro por email e viraria renovação fantasma na curva.
excluded_links as (
  select ml.transaction_code
  from public.dash_gestao_ultimates_manual_links ml
  join public.dash_gestao_ultimates_buyers b on b.id = ml.buyer_id
  where ml.cycle_id = p_cycle_id
    and exists (
      select 1 from excluded_buyers eb where eb.email = lower(btrim(b.email))
    )
),
```

Aplicados em dois pontos:

**(a) CTE `buyers`** — o lead sai da base:

```sql
where b.cycle_id = p_cycle_id
  and not exists (
    select 1 from excluded_buyers eb where eb.email = lower(btrim(b.email))
  )
```

**(b) universo de vendas** (`attributed` no roster, `approved_sales` em daily e hourly) — as vendas dele saem antes de qualquer atribuição, junto do filtro de ofertas que já existe:

```sql
and not exists (
  select 1 from excluded_buyers eb where eb.email = lower(btrim(s.buyer_email))
)
and not exists (
  select 1 from excluded_links el where el.transaction_code = s.transaction_code
)
```

`not exists` (e não `not in`) pelo mesmo motivo documentado na 052: não depender do comportamento de `NULL` da subconsulta.

As três funções precisam da mudança. A 054 já registra a regra: *"Toda mudança futura no filtro de vendas precisa ser aplicada nas duas funções"* — agora são três.

### 6.3 Novo campo `from_manual_link` no roster

`dash_gestao_ultimates_roster` ganha uma coluna no `RETURNS TABLE`:

```sql
from_manual_link boolean
```

Cálculo, dentro de `attributed` e `base_sales_agg`:

```sql
-- em attributed:
l.buyer_id is not null as via_link,

-- em base_sales_agg, com a MESMA ordenação do transaction_code para que os
-- dois se refiram à mesma venda:
coalesce(
  (array_agg(a.via_link order by a.approved_date asc nulls last)
     filter (where a.status in ('APPROVED', 'COMPLETE')))[1],
  false
) as from_manual_link
```

Linhas de novo comprador devolvem `false`.

⚠️ **Mudança de `RETURNS TABLE` exige `drop function` + `create`, não `create or replace`** — e o `DROP` **derruba os grants**, que precisam ser reaplicados na mesma migration. Foi exatamente o que obrigou a 051 a reaplicá-los; a 052 documenta a diferença.

### 6.4 APIs

| Rota | Método | Papel | Comportamento |
|---|---|---|---|
| `/api/ultimates/cycles/[id]/excluded-buyers` | `GET` | `gestor`, `analista` | Lista os leads excluídos com nota, autor e data. Resolve `name` fazendo lookup em `dash_gestao_ultimates_buyers` do ciclo pelo email (pode vir `null` se o email saiu do CSV) |
| `/api/ultimates/cycles/[id]/excluded-buyers` | `POST` | `gestor` | Body `{ email, note? }`. Normaliza o email antes de gravar. 404 se ciclo não existe; **400 se o email não pertence à base do ciclo** (a ação só existe em linhas da base); 409 se já excluído. Grava `excluded_by = userId` |
| `/api/ultimates/cycles/[id]/excluded-buyers` | `DELETE` | `gestor` | Body `{ email }`, normalizado. 404 se não estiver na lista |
| `/api/ultimates/cycles/[id]/buyers/[buyerId]` | `PATCH` | `gestor` | Body `{ name?, phone? }`, ambos trimados e vazio → `null`. 404 se o buyer não é do ciclo; **409 se ciclo encerrado**. Não toca `email` nem `extra` |

`GET`/`POST`/`DELETE` de `excluded-buyers` **não** checam `status = 'encerrado'` (regra 4.5), no mesmo idioma de `excluded-offers`.

`POST /api/ultimates/links` fica **inalterado** — o vínculo invertido é a mesma rota, chamada de outro lugar da UI.

### 6.5 Frontend

- `src/components/ultimates/exclude-buyer-modal.tsx` (novo) — confirmação com contexto da compra + nota opcional.
- `src/components/ultimates/excluded-buyers-modal.tsx` (novo) — lista e restaura; molde do `excluded-offers-modal.tsx`.
- `src/components/ultimates/mark-renewed-modal.tsx` (novo) — vínculo invertido; molde do `link-buyer-modal.tsx`, alimentado pelas linhas `buyer_id = null` já em memória.
- `src/components/ultimates/edit-buyer-modal.tsx` (novo) — nome e telefone.
- `src/components/ultimates/roster-table.tsx` — coluna "Ações" com até três botões; `RowAction` passa a receber os novos handlers; `RosterCards` acompanha; `isRenewedBaseRow` passa a consultar `from_manual_link`.
- `src/components/ultimates/ultimates-dashboard.tsx` — botão "Leads excluídos (N)" na barra de ações, contador em efeito próprio e tolerante a falha (mesmo padrão de `excludedCount`), estados dos quatro modais e `handleWriteDone`.
- `src/components/ultimates/kpi-row.tsx` — `sub` do tile Base.
- `src/types/ultimates.ts` — `UltimatesExcludedBuyerRecord`; `from_manual_link?: boolean` em `UltimatesRosterRow` (**opcional**, ver riscos).
- `src/components/ultimates/types.ts` — `ExcludedBuyer`.
- Estilos reaproveitados de `ultimates.css` e do tema escuro compartilhado — sem CSS novo de identidade.

Gate de UI: `Excluir` exige `role === "gestor"`; `Marcar renovado`, `Editar` e `Desfazer vínculo` exigem o `canWrite` atual (`gestor` **e** ciclo não encerrado).

## 7. Critérios de aceite

1. `gestor` exclui um lead da base pela linha do roster, com nota opcional, e ele some da tabela, dos KPIs, do card Evolução e do CSV exportado — todos continuando a bater entre si.
2. Lead excluído que tinha renovação aprovada leva a venda junto: ela **não** reaparece como novo comprador nem como ponto na curva, em nenhuma das duas granularidades.
3. Venda vinculada manualmente a um lead excluído também sai da contabilidade; o vínculo permanece na tabela sem efeito.
4. Excluir a mesma pessoa duas vezes no mesmo ciclo é recusado (409).
5. Excluir um email que não pertence à base do ciclo é recusado (400).
6. Após excluir 3 leads, o botão exibe "Leads excluídos (3)" e o tile Base exibe "3 excluídos"; com a lista vazia, nenhum dos dois aparece.
7. Restaurar um lead o devolve inteiro — com vendas e vínculos — na leitura seguinte, sem "Atualizar agora".
8. Um novo upload de CSV contendo o email excluído **não** o ressuscita.
9. `gestor` marca um "não renovado" como renovado escolhendo uma compra não atribuída: a linha passa a "Renovado" com data, valor e transação reais, a compra some de "Novos Compradores" e o card Evolução não muda de total.
10. Com zero compras não atribuídas no ciclo, "Marcar renovado" fica desabilitado com explicação.
11. `gestor` corrige nome e telefone de um lead; o email não é editável e o modal avisa que a correção vale até o próximo upload.
12. "Desfazer vínculo" aparece apenas em renovação vinda de vínculo manual — e o 404 "esta renovação não veio de um vínculo manual" deixa de ser alcançável pela UI.
13. Em ciclo encerrado, a linha oferece apenas "Excluir"; `PATCH` de cadastro e `POST /links` respondem 409.
14. `analista` vê a lista de excluídos em modo leitura e nenhuma ação na tabela; `POST`/`DELETE`/`PATCH` respondem 403.
15. A exclusão é por ciclo: outro ciclo do mesmo produto não é afetado, e os dashboards Hotmart/Indicadores continuam idênticos.

## 8. Riscos e pontos de atenção

- **A meta muda sem aviso.** Excluir leads altera o denominador do % de renovação, número já observado, e a classificação é derivada em leitura, sem histórico. Mitigado pelo contador no botão, pelo subtítulo do tile Base e pelo registro de autor/data/nota — mas quem não abrir o modal só vê o contador.
- **Receita some junto.** Excluir um lead que renovou remove a compra dele das curvas e da soma de valores. É a decisão registrada (#3), e é o efeito mais fácil de aplicar sem perceber. O modal de confirmação exibe data e valor da compra justamente por isso.
- **`RETURNS TABLE` alterado.** Como a migration precisa de `DROP`, o roster fica indisponível entre o drop e o create, e os grants precisam ser reaplicados na mesma migration. Além disso, enquanto a 055 não subir, a RPC antiga não devolve `from_manual_link`: por isso o campo é **opcional** no tipo e o front deve cair no comportamento atual (oferecer "Desfazer vínculo" em toda renovação) quando vier `undefined` — mesma estratégia de degradação já usada para a série horária.
- **Vínculo órfão silencioso.** Por 4.3, excluir um lead pode deixar vínculos manuais sem efeito. Restaurar o lead os reativa. Não há tela que liste vínculos órfãos.
- **Exclusão sobrevive ao CSV.** É o comportamento pedido (RF-5), mas é contraintuitivo: quem reimportar a base achando que "zera tudo" não vai ver o lead voltar. O modal de upload não sinaliza isso hoje.
- **Ciclo encerrado parcialmente editável.** Três ações na mesma linha com regras diferentes de status. Vale documentar no código para não ser "corrigido" depois como inconsistência.
- **Cobertura de teste.** O efeito real do filtro vive em SQL, que os testes Jest do repo não executam. Os testes cobrem rotas e UI com mocks; a validação da classificação filtrada precisa ser manual, com dados reais.
- **Fila de migrations.** As migrations 049–054 ainda não foram aplicadas no Supabase deste ambiente, o que já bloqueia a validação das features anteriores do Ultimates. A 055 entra nessa fila e depende de todas as anteriores.

## 9. Decisões registradas (entrevista de 2026-07-30)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Problemas a resolver | Lixo na base afundando a meta; classificação errada sem caminho de correção; dado errado no cadastro |
| 2 | Natureza da exclusão | **Soft e reversível**, em tabela própria filtrada nas RPCs (não `DELETE`, não filtro só no cliente) |
| 3 | Compra do lead excluído | **Some do ciclo também** — roster, daily e hourly |
| 4 | Alcance da exclusão | **Só linhas da base**; novo comprador não tem a ação |
| 5 | Chave da exclusão | **Email normalizado**, para alcançar as vendas e sobreviver ao re-upload |
| 6 | "Marcar como renovado" | **Vínculo invertido** sobre `manual_links`; override livre rejeitado |
| 7 | "Marcar como novo comprador" | **Fora de escopo** |
| 8 | Campos editáveis | **Nome e telefone**; email fora |
| 9 | Edição × upload de CSV | **Aceitar a sobrescrita e avisar** no modal |
| 10 | Granularidade da ação | **Um a um pela linha**, sem seleção múltipla |
| 11 | Reversão | **Modal "Leads excluídos"** com restaurar, molde do de ofertas |
| 12 | UI da ação | **Botões inline curtos**, sem dropdown novo |
| 13 | Ciclo encerrado | **Só excluir/restaurar**; vínculo e edição bloqueados |
| 14 | Transparência | **Contador no botão + subtítulo no tile Base** |
| 15 | Justificativa | **Nota opcional**, como em ofertas excluídas |
| 16 | Escopo entre ciclos | **Por ciclo** |
| 17 | Botão fantasma "Desfazer vínculo" | **Corrigido nesta feature** via `from_manual_link` |
