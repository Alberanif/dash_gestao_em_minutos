# Dash Ultimates — filtro seletor de datas

**Data:** 2026-07-31
**Módulo:** `/ultimates`
**Branch:** `feat/ultimates-filtro-datas`
**Status:** implementado (7 commits de código + testes); migration `058` pendente de
aplicação — ver `docs/OPS_2026-07-31_ultimates_filtro_datas.md`.

## Problema

O dashboard do ciclo (`ultimates-dashboard.tsx`) não tem nenhum recorte temporal. As três
RPCs de leitura — `dash_gestao_ultimates_roster`, `_daily` e `_hourly` — filtram por
**produto + status**, nunca por período: o ciclo
(`dash_gestao_ultimates_cycles`) sequer tem colunas de início e fim. Consequência prática,
já registrada em `cumulative-chart.ts:TETO_HORAS_PREENCHIDAS`: o card "Evolução" desenha
**todo o histórico de vendas do produto**, não o do ciclo corrente.

Quem acompanha um ciclo precisa perguntar "quantas renovações e quantos novos compradores
entre o dia X e o dia Y" — durante uma campanha, num fim de semana, na semana do
lançamento. Hoje não há como.

## Solução

Uma barra `De / Até / Aplicar / Limpar` abaixo do cabeçalho do ciclo, acima da seção 01.
Sem intervalo, o dashboard se comporta exatamente como hoje. Com intervalo aplicado, as
métricas de **movimento** (renovações, reembolsos, novos compradores, gráfico, tabela)
passam a cobrir só o período, enquanto as métricas de **estoque** (base, não renovados,
meta) continuam medindo o ciclo inteiro.

O intervalo escolhido é persistido em `localStorage` e restaurado na volta.

## Decisões

| # | Decisão | Escolha |
| --- | --- | --- |
| 1 | Alcance do filtro | **Tudo**: gráfico, KPIs e tabela do roster |
| 2 | Quem renovou fora do intervalo | **Some da visão** — o roster mostra só quem teve venda no período |
| 3 | Tiles "Base", "Não renovados" e barra de meta | **Ciclo inteiro**, mesmo com filtro ativo |
| 4 | Recorte do gráfico | **No cliente**, por comparação de string das chaves de bucket |
| 5 | Recorte do roster/KPIs | **No banco**, migration `058` com `p_start`/`p_end` |
| 6 | Contrato da carga | **Duas chamadas** ao roster quando há intervalo: a atual (ciclo) e a recortada |
| 7 | Degradação | A chamada recortada **degrada sozinha**, no molde do `hourly` |
| 8 | Estado inicial | **Vazio = ciclo inteiro**; nada de default "últimos 7 dias" |
| 9 | Persistência | Chave **única** `ultimates-date-range`, sobrevive à troca de ciclo |
| 10 | Fuso de interpretação do intervalo | **UTC**, o mesmo de `_daily` e do roster |
| 11 | URL | O intervalo **não** vai para a query string |

### Por que estoque e movimento se separam (decisões 2 e 3)

As duas escolhas parecem contraditórias — "some da visão" e "base do ciclo inteiro" — e
não são. O roster tem duas naturezas misturadas na mesma tabela:

- **Movimento**: linhas com venda (`renovado`, `renovacao_reembolsada`, `novo_comprador`,
  `novo_reembolsado`). Têm data, então recortar por período é uma pergunta bem formada.
- **Estoque**: `nao_renovado` é ausência de venda. Não tem data. "Não renovados entre 10 e
  20 de julho" não significa nada — ou significa "todo mundo que não renovou naquela
  janela", que num intervalo de dois dias seria quase a base inteira.

Filtrar tudo pelo mesmo critério destruiria a barra de meta: a base encolheria até virar
"quem renovou", o denominador acompanharia o numerador e o percentual ficaria colado em
100% em qualquer intervalo — um indicador que sempre diz a mesma coisa não informa nada.

Por isso `Base`, `Não renovados` e a meta ficam ancorados no ciclo, e o aviso do card 01
declara o recorte misto em vez de deixar o leitor descobrir sozinho:

```
Renovações e novos compradores restritos a 10/07 – 20/07 · Base e meta seguem o ciclo inteiro
```

Essa nota segue o mesmo princípio das notas de ofertas e leads excluídos que já existem no
card: quando um número exibido passou por um filtro, o dashboard diz — senão mente por
omissão para quem só bate o olho nos tiles.

### Por que o gráfico é recortado no cliente e o roster no banco (decisões 4 e 5)

**O gráfico não precisa do banco.** As chaves que a RPC devolve já são o recorte: `day` é
`YYYY-MM-DD` e `hour` é `YYYY-MM-DDTHH`, ambas **texto**, ambas em ordem lexicográfica ==
ordem cronológica (premissa que `buildCumulativeSeries` já explora para ordenar). Filtrar é
comparar os 10 primeiros caracteres com as strings do `<input type="date">`. Nenhum objeto
`Date` é construído, nenhum fuso do navegador entra na conta, e o resultado é exato.

**O roster não pode ser recortado no cliente.** Ele expõe `renewed_at`, mas isso é
`min(approved_date) filter (where status in ('APPROVED','COMPLETE'))` — a **primeira**
compra aprovada, agregada. Dois furos decorrem disso:

1. Quem comprou em 05/07 e de novo em 15/07 tem `renewed_at = 05/07` e sumiria de um
   recorte 10–20/07 no qual comprou de verdade.
2. Linha `renovacao_reembolsada` só tem venda reembolsada, e o `filter` acima é de
   aprovadas: `renewed_at` é **null**. Recortar por ele zeraria o tile "Renovação
   reembolsada" em todo e qualquer intervalo.

O segundo furo é um número visivelmente errado na tela, não um caso de borda. Então o
recorte do roster desce para o SQL, onde as vendas ainda estão desagregadas.

### O recorte no SQL (decisão 5)

A migration `058` substitui `dash_gestao_ultimates_roster(uuid)` por
`(p_cycle_id uuid, p_start date default null, p_end date default null)`. O filtro entra em
**um único lugar**, o CTE `attributed`, que é por onde toda venda passa antes de ser
agregada:

```sql
and (p_start is null or s.approved_date::date >= p_start)
and (p_end   is null or s.approved_date::date <= p_end)
```

Restringir `attributed` propaga o recorte para todos os derivados de graça:
`base_sales_agg` e `new_sales_agg` passam a agregar só as vendas da janela, e as
categorias caem sozinhas no lugar certo — quem não tem venda na janela vira
`nao_renovado` (e é descartado na exibição, decisão 2), quem só tem reembolso na janela
vira `renovacao_reembolsada`, e assim por diante.

`DROP` + `CREATE` (a assinatura muda; o Postgres não permite trocar a lista de argumentos
com `CREATE OR REPLACE`) e **reaplicação dos grants**, que morrem junto com a função — o
mesmo cuidado que as migrations `051` e `055` documentam. Os parâmetros têm `default null`,
então `rpc("dash_gestao_ultimates_roster", { p_cycle_id })` continua válido depois da
migration e nenhum chamador existente quebra.

O corpo da função é a cópia **verbatim** da definição vigente (migration `056`, linhas
82–245), com as duas condições acima como única diferença — verificado por `diff` na
implementação. Copiar em vez de reescrever preserva os comentários que documentam decisões
das migrations 050–056.

Número **058** reservado de propósito: a `057` já está tomada pelo branch
`feat/ultimates-multi-produto`, ainda não mergeado.

### Duas chamadas ao roster, não uma (decisão 6)

Com intervalo ativo o dashboard precisa de dois conjuntos ao mesmo tempo: o do ciclo (para
Base, Não renovados e meta) e o da janela (para Renovados, Reembolsados, Novos Compradores
e a tabela). Nenhum dos dois é derivável do outro no cliente — é a mesma razão da decisão 5.

Então:

- `GET /api/ultimates/cycles/[id]/roster` — **inalterada**, é a fonte do ciclo.
- `GET /api/ultimates/cycles/[id]/roster?start=YYYY-MM-DD&end=YYYY-MM-DD` — a fonte da
  janela.

Sem intervalo, só a primeira é feita — o custo de rede de quem não usa o filtro não muda.

### Degradação (decisão 7)

A fila de migrations deste ambiente anda dias atrás do código: `049` a `056` já foram
mergeadas e ainda não subiram. Se a chamada recortada fosse obrigatória, o dia do deploy
seria o dia em que a aba inteira quebra.

Por isso ela é modelada como o `hourly`: `null` significa **indisponível**, não
"carregando". Se o PostgREST devolver `PGRST202` (função sem os parâmetros novos, ou seja,
migration não aplicada), o dashboard carrega inteiro com os números do ciclo e a barra
exibe `Recorte por data indisponível — migration pendente`. A carga obrigatória de hoje
(roster + daily) não ganha nenhum pré-requisito novo.

### Fuso do intervalo (decisão 10)

O `<input type="date">` produz uma data de calendário sem fuso. Ela é interpretada em
**UTC**, porque é o fuso do resto do dash: `format.ts` extrai componentes UTC de propósito,
a RPC `_daily` agrupa por `approved_date::date` na sessão UTC do Supabase, e o filtro novo
usa exatamente essa mesma expressão — os dois recortes concordam por construção, não por
coincidência.

A visão **hora** é a única em fuso America/Sao_Paulo (decisão 3 do spec de evolução por
hora, 2026-07-30), então ela herda a divergência de fronteira que aquele spec já documenta
e aceita: uma venda das 22h de 30/07 (BRT) entra em `31/07` na visão dia e em `30/07 22h`
na visão hora. Com o filtro, isso significa que os extremos do intervalo podem
incluir/excluir até uma noite de diferença entre as duas granularidades. É a divergência
que já existe, não uma nova.

## Arquitetura

```
                    ┌──────────────────────────────────────┐
                    │ date-range.ts  (puro, sem React)     │
                    │  · parse/validação de "YYYY-MM-DD"   │
                    │  · ler/gravar/limpar localStorage    │
                    │  · keyInRange(key, range)            │
                    └──────────────┬───────────────────────┘
                                   │
        ┌──────────────────────────┴─────────────────────────┐
        │                                                    │
┌───────▼────────────┐                        ┌──────────────▼──────────────┐
│ date-range-filter  │  onChange(range)       │ ultimates-dashboard         │
│ (barra De/Até)     ├───────────────────────►│  · roster    (ciclo)        │
└────────────────────┘                        │  · rosterRange (janela)     │
                                              │  · daily/hourly → recorte   │
                                              └──────┬───────────┬──────────┘
                                                     │           │
                                     kpis do ciclo   │           │  kpis da janela
                                     + kpis da janela│           │  + linhas
                                              ┌──────▼───┐  ┌────▼────────┐
                                              │ kpi-row  │  │ roster-table│
                                              └──────────┘  └─────────────┘
```

`date-range.ts` concentra tudo que é decidível sem React — formato, ordem das pontas,
serialização e o predicado de recorte — e é o único lugar testável sem montar componente.
`date-range-filter.tsx` é só entrada e validação de formulário; quem sabe o que o intervalo
significa é o dashboard.

### Contratos

```ts
// src/lib/ultimates/date-range.ts
export interface DateRange {
  start: string; // "YYYY-MM-DD"
  end: string;   // "YYYY-MM-DD", sempre >= start
}

// null = intervalo ausente/inválido (nunca lança, nunca meio-intervalo)
export function parseDateRange(start: string, end: string): DateRange | null;
export function readStoredRange(): DateRange | null;
export function writeStoredRange(range: DateRange): void;
export function clearStoredRange(): void;

// Recorte do gráfico. `key` é "YYYY-MM-DD" ou "YYYY-MM-DDTHH" — só os 10
// primeiros caracteres importam.
export function keyInRange(key: string, range: DateRange | null): boolean;
```

```ts
// src/lib/ultimates/cumulative-chart.ts — assinaturas estendidas
buildCumulativeSeries(days, series, range?: DateRange | null): CumulativePoint[]
buildHourlyCumulativeSeries(hours, series, range?: DateRange | null): CumulativePoint[]
```

O recorte acontece **antes** do acúmulo: a curva começa do zero no primeiro bucket do
intervalo, respondendo "quanto entrou no período" em vez de exibir uma fatia deslocada da
curva do ciclo. O preenchimento de horas vazias passa a operar sobre a lista já recortada,
o que só reduz o vão — o teto de `8760h` continua valendo sem alteração.

```ts
// GET /api/ultimates/cycles/[id]/roster?start&end
{ rows: UltimatesRosterRow[] }               // 200
{ error: "Intervalo inválido" }              // 400 — só uma ponta, ou fim < início
{ error: "Recorte por data indisponível" }   // 501 — RPC sem os parâmetros
```

O `501` é o que o cliente traduz em `rosterRange = null`. Distingui-lo do `500` genérico
importa: um é "a migration não subiu ainda" e o outro é falha real, e o aviso na tela é
diferente. Sem intervalo pedido, `PGRST202` continua sendo `500` — ali não há recorte a
degradar.

A rota **não** descarta as linhas `nao_renovado` da resposta recortada — ela devolve o
roster inteiro da janela, e o descarte (decisão 2) é do dashboard, na hora de montar a
tabela. Assim a rota tem um contrato só, igual com e sem `start`/`end`, e a exibição
continua sendo decisão de quem exibe. O `aggregateRosterKpis` também roda sobre as linhas
**não** descartadas — ele nunca consulta `base` nem `naoRenovados` da janela (esses dois
vêm do ciclo), e passar a lista completa evita uma segunda variante da lista circulando
pelo componente.

### De onde sai cada número

| Tile / elemento | Sem filtro | Com filtro |
| --- | --- | --- |
| Base | ciclo | ciclo |
| Renovados (valor) | ciclo | **janela** |
| Renovados (subtítulo) | `N% da base` | `no período` |
| Renovação reembolsada | ciclo | **janela** |
| Não renovados (valor e dica) | ciclo | ciclo |
| Novos Compradores / Renovações sem vínculo | ciclo | **janela** |
| Barra de meta | ciclo | ciclo |
| Gráfico | ciclo | **janela** |
| Tabela do roster | ciclo | **janela**, sem as linhas `nao_renovado` |

O subtítulo do tile "Renovados" troca de texto porque `N% da base` misturaria numerador da
janela com denominador do ciclo na mesma frase — um percentual que não significa nem uma
coisa nem outra. O percentual do ciclo continua existindo, na barra de meta logo abaixo.

Quando `rosterRange` é `null` por indisponibilidade (decisão 7), **toda** a coluna "com
filtro" cai de volta para o ciclo: nenhum tile fica em branco ou zerado por falta de dado.
No código isso é uma variável só, `recorteAtivo` — gráfico, tiles e tabela leem dela, então
curva e números nunca podem discordar.

## Comportamento detalhado

| Situação | Resultado |
| --- | --- |
| Sem nada no `localStorage` | Barra vazia, dashboard igual ao de hoje |
| `localStorage` com intervalo válido | Restaurado e aplicado na montagem |
| `localStorage` corrompido / meia ponta | Ignorado e apagado; barra nasce vazia |
| Só uma ponta preenchida na UI | "Aplicar" bloqueado com `Preencha as duas datas` |
| Fim anterior ao início | "Aplicar" bloqueado com `A data final não pode ser anterior à inicial` |
| "Limpar" | Volta ao ciclo inteiro e remove a chave |
| Troca de ciclo | Intervalo **permanece** (mesmo critério de `series` e `granularity`) |
| Intervalo sem nenhuma venda | Tiles de período em 0, gráfico com "Sem renovações no período selecionado.", tabela vazia |
| Refresh / ação de escrita | Recarrega as duas chamadas, intervalo intacto |

Exportação CSV segue exportando o que a tabela mostra — com filtro ativo, as linhas do
período.

## Testes

| Arquivo | Cobre |
| --- | --- |
| `src/lib/ultimates/__tests__/date-range.test.ts` | validação das pontas, round-trip do `localStorage`, storage indisponível, chave corrompida, `keyInRange` nas duas larguras de chave |
| `src/lib/ultimates/__tests__/cumulative-chart.test.ts` | acúmulo reinicia no primeiro bucket do intervalo; recorte nas duas granularidades; `range = null` mantém o comportamento atual |
| `src/app/api/ultimates/cycles/[id]/roster/__tests__/route.test.ts` | params repassados à RPC; `400` em intervalo inválido; `501` quando a RPC não tem os parâmetros; `500` preservado para falha real e para `PGRST202` sem intervalo |
| `src/components/ultimates/__tests__/kpi-row.test.tsx` | tiles de estoque leem do ciclo e os de movimento da janela; subtítulo "no período" |
| `src/components/ultimates/__tests__/ultimates-dashboard.test.tsx` | recorte misto dos tiles, aviso presente só com filtro, tabela sem `nao_renovado`, persistência e restauração, degradação no 501 |
| `src/components/ultimates/__tests__/date-range-filter.test.tsx` | bloqueios de validação, "Limpar", indisponibilidade |

## Riscos conhecidos

1. **Reembolso sem `approved_date`.** O recorte filtra por `approved_date::date`, e uma
   venda `REFUNDED` cuja `approved_date` seja nula cai fora de qualquer intervalo — o tile
   "Renovação reembolsada" subcontaria. Não há dado real disponível para dizer se a Hotmart
   produz esse caso; se produzir, a correção é filtrar reembolsos por outra coluna de data,
   e isso é mudança de RPC, não de UI.

2. **Duas cargas do roster.** Com filtro ativo o payload do roster é buscado duas vezes.
   Para uma base de milhares de linhas isso dobra o tráfego dessa aba. Aceito por ora: a
   alternativa (uma rota que devolve os dois conjuntos) acopla os dois recortes numa
   resposta só e derruba a degradação independente da decisão 7.

3. **Migration pendente no deploy.** Enquanto a `058` não subir, o filtro fica visivelmente
   indisponível. É o comportamento desejado (decisão 7), mas significa que a feature só
   pode ser validada de verdade depois que a fila de migrations
   `049 → 050 → 051 → 052 → 053 → 054 → 055 → 056 → 058` for aplicada.

## Fora de escopo

`_daily` e `_hourly` continuam sem parâmetros de data (o recorte delas é no cliente e é
exato). O seletor de ciclos, o `refresh` e a política de novas compras não são tocados.
O intervalo não entra na URL.
