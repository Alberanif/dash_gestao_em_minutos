# Dash Ultimates — fuso horário do recorte e registro por venda

**Data:** 2026-08-02
**Origem:** divergência entre o KPI "Compras" do ciclo "Pitch PC Ao Vivo - 2026"
e os relatórios `sales_history` exportados da Hotmart.

## Problema

O gestor exportou os relatórios da Hotmart para o período 01–02/08/2026 e contou
42 vendas. O dash mostrava 40. A investigação (registrada em "Diagnóstico" abaixo)
confirmou que **nenhuma venda foi perdida na coleta** — as 42 estão gravadas em
`dash_gestao_hotmart_sales`, com status e moeda idênticos ao relatório. A
divergência nasce inteira na leitura, por três causas independentes.

### Causa 1 — o recorte De/Até roda em UTC

`dash_gestao_ultimates_roster` filtra a janela com `s.approved_date::date`. O
cast de `timestamptz` para `date` usa o TimeZone da sessão, que no PostgREST é
UTC. Pedir 01–02/08 devolve, na prática, **01/08 21:00 BRT → 02/08 20:59 BRT**.

Duas vendas de 31/07 à noite entraram na janela por isso:

| transação | comprador | aprovada (UTC) | aprovada (BRT) |
|---|---|---|---|
| `HP0389248222` | vinnys_luiz@yahoo.com.br | 2026-08-01 01:57 | 2026-07-31 22:57 |
| `HP0740908717` | paulapetroli@yahoo.com.br | 2026-08-01 02:17 | 2026-07-31 23:17 |

O mesmo erro existe no bucket de `dash_gestao_ultimates_daily`
(`s.approved_date::date`). Já `dash_gestao_ultimates_hourly` **está correta** —
usa `at time zone 'America/Sao_Paulo'` desde a migration 054. Ou seja: hoje o
gráfico por dia e o por hora do mesmo ciclo discordam entre si, e o filtro De/Até
concorda com o errado.

A causa estrutural é duplicação: `roster`, `daily` e `hourly` repetem o mesmo
bloco de ~47 linhas de CTEs (`prods`, `excluded`, `excluded_buyers`,
`excluded_links`, `buyers`, `links` e quatro `not exists`). Alguém corrigiu o
fuso numa cópia e não nas outras.

### Causa 2 — o roster conta compradores, não vendas

`derivePurchaseKpis` conta **linhas do roster**, e o roster agrega por comprador.
`tatianadreyer@gmail.com` comprou duas vezes no período e ocupa uma linha só; a
segunda compra some do KPI, da tabela e do CSV. No modo "Apenas Compras" isso
está errado por definição: o objeto do ciclo é a compra, não a pessoa.

### Causa 3 — compradores excluídos (não é bug)

Três emails foram excluídos à mão pelo gestor
(`jefftolentino2012@`, `paulapetroli@`, `kawacontasrizzi@`). A exclusão é
intencional e confirmada; o roster os esconde por contrato. O relatório bruto da
Hotmart nunca vai bater com o dash sem descontá-los.

### Diagnóstico — evidência

Comparação dos dois CSVs (`sales_history_20260802153606_...` e
`..._20260802153614_...`) contra o banco, em 2026-08-02:

```
vendas nos relatórios ....................... 42  (3 produtos, todas "Aprovado")
encontradas em dash_gestao_hotmart_sales .... 42  (100%)
divergência de status ....................... nenhuma
divergência de moeda ........................ nenhuma
produtos do CSV fora do ciclo ............... nenhum
```

A venda em moeda estrangeira (`HP2442990234`, CHF) **está** sendo contada — a
hipótese inicial de que o coletor filtrava BRL não se confirmou: a chamada a
`sales/history` em `refresh/route.ts` não passa parâmetro de moeda, e nenhuma
migration do Ultimates (049–063) menciona `currency`.

Reconciliação do número exibido, no instante da exportação (2026-08-02 15:36 UTC):

```
relatório Hotmart (janela 01–02/08 BRT) ...... 42 vendas / 41 emails
banco             (janela 01–02/08 UTC) ...... 44 vendas / 43 emails
  (+2 vendas de 31/07 à noite BRT — as duas da tabela acima)
  − 3 compradores excluídos manualmente
  = 40 linhas ← o que o dash mostrava
```

Durante a investigação uma venda nova foi aprovada (`HP1519454956`,
carinalacerda, 02/08 12:40 BRT) e coletada no refresh das 12:40:51, levando o
dash a 41. O ciclo está ativo: qualquer número absoluto aqui envelhece em
minutos. O que não envelhece são as três causas.

## Solução

1. Extrair a filtragem compartilhada para `dash_gestao_ultimates_cycle_sales`,
   **o único lugar do módulo que escreve fuso horário**, e reescrever `roster`,
   `daily` e `hourly` sobre ela.
2. Criar `dash_gestao_ultimates_purchases`, que devolve **uma linha por venda**
   no shape exato da `roster`.
3. Ramificar `GET .../roster` por `purchases_only` para escolher a RPC.

Tudo numa migration, `064_ultimates_fuso_e_registro_por_venda.sql`.

## Decisões

1. **Um registro por venda vale só no modo Apenas Compras.** Em ciclo de
   renovação a linha precisa existir mesmo quando NÃO houve venda — é isso que
   produz a categoria `nao_renovado` e o denominador da barra de meta. Uma lista
   por venda não consegue representar um comprador sem venda.
2. **As linhas `nao_renovado` desaparecem no modo Apenas Compras.** Vinham do
   `left join` entre a tabela de compradores e as vendas: compradores
   materializados por compras *fora* da janela. Apareciam com valor "—", sem data
   e sem transação, e o filtro de categoria do modo já não as oferecia
   (`CATEGORY_OPTIONS_PURCHASES`). Com a lista nascendo das vendas, somem
   naturalmente.
3. **Editar e Excluir continuam agindo sobre o COMPRADOR.** Excluir tira todas as
   compras do email; Editar corrige nome/telefone da pessoa. Preserva as três
   exclusões já gravadas (que são por email) e mantém o cadastro de comprador como
   fonte única do nome. Excluir uma venda individual não foi pedido — YAGNI.
4. **RPC nova em vez de parâmetro na `roster`.** Um `p_per_sale` exigiria
   DROP+CREATE da `roster` (lição da 058 sobre sobrecarga ambígua) e um retorno
   híbrido com metade das colunas nulas em cada modo. A `roster` fica intacta, e o
   ciclo de renovação não corre risco.
5. **Ramificação na rota existente, não rota nova.** Rota nova custaria ~80 linhas
   duplicadas (auth, parse de intervalo, checagem de ciclo, `PGRST202`,
   normalização de `numeric`) para servir um shape idêntico.
6. **Sem fallback silencioso para a `roster` antiga.** Migration 064 pendente
   devolve 501 nomeando a migration. Cair de volta na RPC antiga mostraria o
   número errado sem avisar — foi assim que a 057 morreu (ver
   `2026-07-30-ultimates-multi-produto-design.md`).

### Por que `dash_gestao_ultimates_purchases` devolve o shape da `roster` (decisão 4)

Porque o mapeamento venda → linha de roster cai natural, e isso zera a mudança na
camada TypeScript:

| coluna do roster | na linha de venda |
|---|---|
| `category` | `renovado` se APPROVED/COMPLETE, senão `renovacao_reembolsada` |
| `renewed_at` | `approved_date` da venda (não mais `min()` do comprador) |
| `total_value` | `price` da venda, `null` se estornada |
| `transaction_code` | a transação da linha (não mais "a primeira das N") |
| `buyer_id` | `matched_buyer_id` — é o que mantém Editar/Excluir funcionando |

`derivePurchaseKpis`, `RosterTable`, `buildRosterCsv` e `ultimates-dashboard`
ficam **sem alteração**. A key do React já é
`` `${row.email}-${row.transaction_code ?? "sem-transacao"}` `` (roster-table.tsx:348),
única por venda. A coluna de data já se rotula "Data da compra" no modo
(roster-table.tsx:519), e o CSV também (csv-export.ts:14).

`total_value = null` para venda estornada preserva a semântica do tile "Valor
total": hoje um comprador só com estorno tem `total_value` nulo e contribui zero.

### Por que extrair a função compartilhada (decisão do fuso)

Sem extrair, `purchases` nasceria como a **quarta** cópia do mesmo bloco de
filtros, e a próxima correção de fuso esqueceria uma de novo. Verifiquei que
fatora limpo: as quatro consumidoras precisam exatamente dos mesmos campos.

## Arquitetura

### 1. Migration `064_ultimates_fuso_e_registro_por_venda.sql`

#### 1.1 `dash_gestao_ultimates_cycle_sales(p_cycle_id uuid, p_start date default null, p_end date default null)`

```
returns table (
  transaction_code text,
  product_id       text,
  offer_code       text,
  status           text,
  currency         text,
  price            numeric,
  approved_date    timestamptz,
  approved_day     date,     -- BRT
  approved_hour    text,     -- BRT, 'YYYY-MM-DD"T"HH24'
  norm_email       text,
  buyer_name       text,
  buyer_phone      text,
  matched_buyer_id uuid,
  via_link         boolean
)
language sql stable security definer set search_path = public
```

Filtros, idênticos aos de hoje: produtos do ciclo
(`dash_gestao_ultimates_cycle_products`), oferta não excluída, comprador não
excluído, vínculo não excluído, e a janela

```sql
and (p_start is null or (s.approved_date at time zone 'America/Sao_Paulo')::date >= p_start)
and (p_end   is null or (s.approved_date at time zone 'America/Sao_Paulo')::date <= p_end)
```

Duas invariantes preservadas de propósito:

- **Não filtra status.** A `roster` precisa de todos os status para categorizar;
  `daily`/`hourly` filtram aprovados por conta própria. O filtro fica em quem
  consome, como hoje.
- **Venda com `approved_date` nulo continua fora de qualquer janela** —
  `approved_day` vira null, a comparação vira null, a linha cai. É o "risco 1" já
  documentado na 058; mantido, não corrigido de contrabando.

`approved_hour` mantém o formato exato de hoje
(`to_char(date_trunc('hour', ... at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD"T"HH24'`)
— `keyInRange` (date-range.ts:65) compara os 10 primeiros caracteres e quebra se o
formato mudar.

Grants: mesma política do módulo — `revoke` de `public, anon, authenticated`,
`grant execute` para `service_role`.

#### 1.2 `dash_gestao_ultimates_purchases(p_cycle_id uuid, p_start date default null, p_end date default null)`

Retorno idêntico ao da `roster`:
`buyer_id, name, email, phone, extra, category, renewed_at, total_value, transaction_code, from_manual_link`.

Corpo: `cycle_sales` + `left join dash_gestao_ultimates_buyers b on b.id = cs.matched_buyer_id`,
restrito aos status contáveis
(`APPROVED, COMPLETE, REFUNDED, CHARGEBACK, CANCELLED, EXPIRED`) — mesmo universo
que a `roster` já exibe. Status transitório continua fora.

`name`, `phone`, `email` e `extra` vêm do cadastro do comprador com fallback nos
campos da venda (`buyer_name`, `buyer_phone`, `norm_email`, `'{}'::jsonb`), para
que a correção manual do gestor continue vencendo o refresh.
`matched_buyer_id` nulo é tolerado (venda coletada antes do próximo
`sync_buyers_from_sales`): a linha aparece, só sem as ações — melhor do que
esconder uma venda real, e se resolve no refresh seguinte.

#### 1.3 `roster`, `daily` e `hourly` reescritas

`CREATE OR REPLACE` nas três, mesma assinatura e mesmo retorno. Cada uma perde
seus ~47 linhas de CTEs e passa a selecionar de `cycle_sales`. `daily` agrupa por
`approved_day`, `hourly` por `approved_hour`; nenhuma volta a escrever expressão
de data.

`daily` e `hourly` chamam `cycle_sales` sem janela (`null, null`) — continuam
devolvendo o ciclo inteiro, e o recorte do gráfico segue no cliente via
`keyInRange`.

### 2. `GET /api/ultimates/cycles/[id]/roster`

O `select` do ciclo passa de `"id"` para `"id, purchases_only"`. A escolha da RPC:

```
purchases_only  →  dash_gestao_ultimates_purchases
senão           →  dash_gestao_ultimates_roster
```

A resposta ganha `granularity: "venda" | "comprador"`. O cliente não depende dela
— já conhece o modo — mas ela torna a ramificação explícita e testável.

O tratamento de `PGRST202` se estende: hoje só vira 501 quando há intervalo
pedido; passa a virar 501 também quando o ciclo é `purchases_only` e a
`purchases` não existe, com mensagem nomeando a migration 064.

### 3. UI

| Componente | Mudança |
|---|---|
| `derivePurchaseKpis` | nenhuma |
| `RosterTable` | nenhuma |
| `ultimates-dashboard` | nenhuma |
| `buildRosterCsv` | nenhuma |
| `SectionHeader` do roster | copy: `"Compradores do ciclo, busca e exportação"` → `"Compras do ciclo, busca e exportação"` quando `purchasesOnly` |
| `exclude-buyer-modal` | aviso novo quando o comprador tem mais de uma compra na janela: excluir age por email e remove todas |

## Testes

O fuso vive em SQL e este repo **não tem harness de teste para RPC** — nenhum
teste unitário pegaria essa classe de bug. É por isso que a correção do `hourly`
(migration 054) nunca se propagou para `daily` e `roster`.

1. **Propriedade de fuso, versionada** (`scripts/verify-ultimates-timezone.mjs`):
   para qualquer dia `D`, toda linha devolvida por `roster`/`purchases` com
   intervalo `[D, D]` tem `approved_date` em `[D 03:00Z, D+1 03:00Z)`.
   Independente do volume de dados; **falha hoje** (`HP0389248222`, 31/07 22:57
   BRT, aparece na janela de 01/08). Roda antes e depois.
2. **Unitário** — `derivePurchaseKpis` com duas linhas do mesmo email e categoria
   `renovado`: `compras === 2`. Trava a semântica nova.
3. **Unitário** — a rota do roster escolhe a RPC por `purchases_only`, devolve
   `granularity` coerente, e responde 501 nomeando a 064 quando a RPC falta.
4. **Conferência real** — reexecutar a comparação CSV × dash e confirmar que o
   número passa a bater com o relatório da Hotmart, descontados os 3 excluídos.

A suíte Jest é transpile-only (`isolatedModules`): a guarda de tipo é `tsc`, não
os testes. Rodar `npx tsc --noEmit` e `npm test`.

## Riscos e dívidas assumidas

1. **`daily` muda de valor em todo ciclo existente**, inclusive o "Encontro dos
   Ultimates - 2026", encerrado. É a correção pedida, mas o gráfico daquele ciclo
   deixa de bater com prints antigos.
2. **Vendas entre 21:00 e 23:59 BRT trocam de dia** no gráfico e no filtro.
   Correto e visível — é o sintoma que motivou o trabalho.
3. **`cycle_sales` NÃO é inlinable — e isso é por construção, não por acaso.**
   A redação anterior desta spec dizia "pode não ser inlineada, medir antes e
   depois". Está errado: o planner só faz inlining de função SQL quando
   `prosecdef = false` **e** `proconfig IS NULL`. Nossa função é
   `security definer` e tem `set search_path = public` — cada uma das duas,
   sozinha, já bloqueia. Não há o que medir; a materialização é certa.

   Por que é aceitável mesmo assim: a janela `p_start`/`p_end` é **argumento**
   da função, então desce para dentro e continua sendo predicado de scan. O
   filtro de produtos também é interno. O que fica de fora é o
   `status in ('APPROVED','COMPLETE')` de `daily`/`hourly`, aplicado depois da
   materialização — sobre o universo do ciclo, que tem 276 linhas dos 11.902
   registros de `dash_gestao_hotmart_sales`. É ruído.

   Tornar a função inlinable exigiria abrir mão de `security definer`, o que
   quebraria o modelo de RLS do módulo. Não vale a troca.
4. **Blast radius.** `roster`, `daily` e `hourly` são reescritas ao mesmo tempo. A
   assinatura e o retorno das três não mudam, mas o corpo muda inteiro; a
   verificação precisa cobrir o ciclo de renovação, não só o Apenas Compras.
5. **Migration parada é o modo de falha conhecido deste ambiente.** A fila anda
   dias atrás do código. O 501 nomeando a 064 é a mitigação: falha alto em vez de
   mostrar número errado.

## Fora de escopo

- **"Valor total" soma moedas diferentes como se fossem reais.** A compra em CHF
  (`HP2442990234`) entra como R$ 311,98; o recebimento real em BRL foi R$
  1.882,89. As RPCs do Ultimates nunca olharam `currency` — diferente do dash
  Hotmart legado, que separa BRL de estrangeira desde a migration 035. Decisão do
  gestor em 2026-08-02: fica para depois. Afetava 1 venda em 42 no relatório
  conferido.
- **Excluir uma venda individual** (hoje a exclusão é sempre por comprador).
- **Contagem por venda em ciclos de renovação.**
- **Coletar taxa de câmbio da Hotmart** para converter estrangeiras em BRL.
