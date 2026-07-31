# PRD — Dash Ultimates: modo "Apenas Compras"

Data: 2026-07-31

## Problem Statement

O gestor que usa o Dash Ultimate hoje só consegue montar um ciclo de
**renovação**: importa uma base de compradores (CSV) e o dashboard cruza essa
base com as vendas Hotmart para dizer quem renovou, quem não renovou e quem é
novo comprador. Existe um caso de uso diferente e igualmente comum: o gestor
quer apenas **acompanhar todas as compras** de um produto dentro de um período,
sem ter uma base de renovação para comparar. Nesse caso, tudo que fala em
"renovação", "base", "não renovado" e "meta de renovação" é ruído — e a
exigência de subir uma lista de renovação para o dashboard funcionar é um
bloqueio.

## Solution

Ao criar um ciclo, o gestor passa a ter a opção **"Apenas Compras"**. Com ela
ligada:

- O ciclo não tem base de renovação — não é possível (nem necessário) subir uma
  lista. **Toda compra aprovada** do produto no ciclo aparece automaticamente no
  Roster como uma "Compra", com **nome, email e telefone**.
- A nomenclatura da tela troca de "Renovação" para "Compras": o dashboard passa
  a falar a língua de quem monitora vendas, não renovações.
- Os números do topo passam a ser sobre compras (quantas, quantas
  reembolsadas, valor total), e não sobre a saúde de uma base.

O ciclo de renovação continua existindo exatamente como hoje para quem não
liga a opção. "Apenas Compras" é um segundo modo, escolhido na criação e fixo
depois disso.

## User Stories

1. Como gestor, quero uma opção "Apenas Compras" no modal de criação de ciclo,
   para montar um dashboard que monitora compras em vez de renovações.
2. Como gestor, quero que a opção "Apenas Compras" seja definida na criação e
   fique imutável depois, para não corromper o ciclo trocando o modelo no meio
   da operação.
3. Como gestor, quero ver a opção "Apenas Compras" de forma somente-leitura ao
   editar um ciclo existente, para saber em qual modo aquele ciclo está sem
   poder alterá-lo por engano.
4. Como gestor em um ciclo "Apenas Compras", quero que toda compra aprovada do
   produto apareça automaticamente no Roster, para não precisar cadastrar nada
   manualmente.
5. Como gestor em um ciclo "Apenas Compras", quero ver nome, email e telefone
   de cada comprador no Roster, para conseguir contatar e reconhecer quem
   comprou.
6. Como gestor em um ciclo "Apenas Compras", quero que compras do mesmo email
   sejam agrupadas em uma única linha (valores somados), para ter uma visão por
   pessoa, coerente com o resto do produto.
7. Como gestor em um ciclo "Apenas Compras", não quero ver o botão "Carregar
   base", porque não existe base de renovação nesse modo.
8. Como gestor em um ciclo "Apenas Compras", não quero ver o interruptor "Novas
   Compras", porque ele classifica vendas contra uma base que não existe aqui.
9. Como gestor em um ciclo "Apenas Compras", quero que os KPIs do topo mostrem
   Compras, Compras reembolsadas e Valor total, para medir o que importa nesse
   modo.
10. Como gestor em um ciclo "Apenas Compras", não quero ver a meta de renovação
    nem a barra de progresso, porque um percentual de uma base inexistente não
    tem sentido.
11. Como gestor criando um ciclo "Apenas Compras", quero que o campo "Meta de
    renovação (%)" desapareça ao ligar a opção, para não preencher um dado
    inútil.
12. Como gestor em um ciclo "Apenas Compras", quero que a coluna e o rótulo
    "Renovação" virem "Compra" em toda a tela (badge, filtro, coluna da tabela,
    card mobile, títulos das seções e do gráfico).
13. Como gestor em um ciclo "Apenas Compras", quero que o gráfico de evolução
    mostre uma única série "Compras acumuladas", sem seletor de séries, porque
    só há uma coisa a acompanhar.
14. Como gestor em um ciclo "Apenas Compras", quero poder **editar** o nome e o
    telefone de um comprador, para corrigir um cadastro vindo torto da Hotmart.
15. Como gestor em um ciclo "Apenas Compras", quero que minha correção de
    nome/telefone **sobreviva às próximas atualizações**, para não reescrever a
    mesma correção a cada refresh.
16. Como gestor em um ciclo "Apenas Compras", quero poder **excluir** uma compra
    da contabilidade (ex.: uma compra de teste), para os números não mentirem.
17. Como gestor em um ciclo "Apenas Compras", não quero ver as ações "Vincular à
    base", "Marcar renovado" e "Desfazer vínculo", porque não há base para
    vincular.
18. Como gestor em um ciclo "Apenas Compras", quero continuar excluindo ofertas
    da contabilidade, para tirar das compras vendas que não deveriam contar.
19. Como gestor em um ciclo "Apenas Compras", quero continuar usando o filtro
    De/Até, para recortar as compras por período.
20. Como gestor em um ciclo "Apenas Compras", quero exportar o CSV do Roster com
    a nomenclatura de compras, para trabalhar a lista fora do dashboard.
21. Como gestor, quero que ciclos de renovação existentes continuem funcionando
    exatamente como hoje, para que a nova opção não mude nada de quem não a usa.
22. Como visualizador (não gestor) de um ciclo "Apenas Compras", quero ver o
    dashboard no modo compras sem ações de escrita, coerente com meu papel.

## Implementation Decisions

### Modelo de dados: "materializar compras como buyers"

Decisão central. Em vez de inventar um novo caminho de leitura para o Roster,
o modo "Apenas Compras" **materializa cada email de venda aprovada como um
`buyer`** do ciclo. Assim a RPC de roster, os KPIs, e as ações Editar/Excluir já
existentes continuam funcionando sem reescrita — as linhas passam a ter
`buyer_id` e caem naturalmente como `renovado` / `renovacao_reembolsada`, que a
UI reetiqueta para "Compra" / "Compra reembolsada".

- **Nova coluna** `purchases_only boolean not null default false` em
  `dash_gestao_ultimates_cycles`.
- **Nova RPC aditiva** de sincronização (ex.: `dash_gestao_ultimates_sync_buyers_from_sales`)
  que faz `INSERT ... ON CONFLICT (cycle_id, email) DO NOTHING` a partir das
  vendas aprovadas do produto do ciclo. **Não** reaproveitar
  `dash_gestao_ultimates_replace_buyers`: ela faz delete+reinsert e apagaria
  edições e linhas. A sincronização é **só inserção** — email que já existe não
  tem nome/telefone sobrescrito, então correção manual do gestor sobrevive a
  todo refresh.
- Dedup por email é herdada do modelo atual: uma linha por email, valores
  somados pela RPC de roster. "Compras" = compradores distintos.

### Gatilho da sincronização

- A sincronização roda no **refresh** do ciclo (mesma rota/fluxo de "Atualizar
  agora"), condicionada a `purchases_only = true`. Ciclo de renovação não
  dispara a sincronização.

### Rotas de ciclo

- **POST** `/api/ultimates/cycles` aceita `purchasesOnly` na criação.
- **PATCH** `/api/ultimates/cycles/[id]` **rejeita** qualquer mudança de
  `purchases_only` (imutável) — a alteração é ignorada ou responde erro, nunca
  aplicada.

### Módulo profundo novo: reetiquetagem/derivação de compras

Espelha o padrão comprovado de `new-purchases-mode.ts`: funções **puras**, sem
React, testáveis isoladamente.

- Reetiqueta categorias para o vocabulário de compras
  (`renovado`→"Compra", `renovacao_reembolsada`→"Compra reembolsada").
- Deriva os KPIs de compra a partir das linhas do roster: **Compras** (linhas de
  compra), **Compras reembolsadas**, **Valor total** (soma de `total_value`).
- Com `purchases_only = false`, devolve a mesma referência recebida (não copia),
  para não invalidar memoização de quem consome — igual ao contrato de
  `new-purchases-mode.ts`.

### KPIs

- Modo ligado: KpiRow mostra **Compras · Compras reembolsadas · Valor total**.
  Some os tiles Base, Renovados, Não renovados, Novos Compradores e a
  `GoalProgressBar`.
- Modo desligado: KpiRow inalterado.

### Roster

- Toda linha é uma compra (nome, email, telefone). Grão = uma por email.
- Ações por linha no modo ligado: **Editar** e **Excluir** apenas. Removidas
  "Vincular à base", "Marcar renovado", "Desfazer vínculo".
- Editar persiste via o PATCH de buyer já existente (as linhas têm `buyer_id`,
  por causa da materialização). Excluir usa a exclusão por email já existente
  (`excluded-buyers`).
- Colunas/badges/filtros reetiquetados: "Data da renovação"→"Data da compra",
  badge/filtro `renovado`→"Compra", card mobile "Renovação"→"Compra".

### Gráfico de evolução

- Modo ligado: série única **"Compras acumuladas"**, sem seletor de séries
  (mesmo colapso que `counts_new_buyers = false` já aplica). Filtro De/Até
  continua recortando a curva.

### Nomenclatura (modo ligado)

| Superfície | Renovação (atual) | Apenas Compras |
|---|---|---|
| Badge/filtro `renovado` | Renovado | Compra |
| Badge/filtro `renovacao_reembolsada` | Renovação reembolsada | Compra reembolsada |
| Coluna da tabela | Data da renovação | Data da compra |
| Campo card mobile | Renovação | Compra |
| Descrição Seção 01 | Base, renovações e novos compradores | Compras do ciclo |
| Descrição Seção 02 | Renovações acumuladas | Compras acumuladas |
| Série do gráfico | Renovações | Compras |

### Barra do cabeçalho (modo ligado)

- Escondidos: "Carregar base", interruptor "Novas Compras".
- Mantidos: "Ofertas excluídas", "Leads excluídos", "Atualizar agora", filtro
  De/Até.

### Modal de criação/edição de ciclo

- Interruptor "Apenas Compras" no topo do modal de criação. Ligado → esconde o
  campo "Meta de renovação (%)".
- No modal de edição, o modo aparece **somente-leitura**.

### Propagação da flag

- `purchases_only` viaja no `CycleWithProduct` ao lado de `counts_new_buyers`.
  A UI ramifica nele. Quando ligado, `counts_new_buyers` é irrelevante e seu
  interruptor fica escondido.

## Testing Decisions

Bons testes exercitam **comportamento externo**, não implementação: dado um
conjunto de linhas de roster ou um estado de props, verificam a saída visível
(rótulos, tiles, ações presentes/ausentes, resposta HTTP), nunca detalhes
internos. Prior art no repo: `__tests__/new-purchases-mode` (funções puras),
`__tests__/kpi-row` e `__tests__/roster-table` (componentes),
`api/ultimates/cycles/__tests__/route.test.ts` (rotas).

- **Módulo de reetiquetagem/derivação de compras** (novo, puro): reetiquetagem
  de categorias e derivação dos KPIs (Compras / reembolsadas / valor total)
  sobre fixtures de roster; identidade preservada quando `purchases_only =
  false`. Espelha os testes de `new-purchases-mode`.
- **`kpi-aggregation`**: derivação dos KPIs de compra sobre fixtures.
- **`roster-table` + `ultimates-dashboard`**: modo ligado esconde toggle e
  "Carregar base", reetiqueta colunas/badges, e mostra só Editar+Excluir nas
  ações. Espelha os testes de componente existentes.
- **Rotas de criação/edição de ciclo**: POST aceita `purchasesOnly`; PATCH
  rejeita mudança de `purchases_only` (imutável).

## Out of Scope

- Alternar "Apenas Compras" depois da criação (é imutável por decisão).
- Meta absoluta de compras / barra de progresso de compras (meta é removida
  neste modo, não substituída).
- Grão por transação no Roster (o modo agrupa por email; múltiplas compras do
  mesmo email = uma linha somada).
- Propagação automática de correções de nome da Hotmart sobre linhas já
  existentes (a sincronização é só inserção; edição do gestor prevalece).
- Renomear o placeholder do nome do ciclo ("Renovação Julho/2026") — cosmético,
  fica como está.

## Further Notes

- O modo reaproveita ao máximo a maquinaria existente (RPC de roster, KpiRow,
  Editar, Excluir, exclusão de ofertas, filtro De/Até). O grosso do trabalho é
  uma migração + uma RPC aditiva + ramificação de UI pela flag e uma camada
  fina de reetiquetagem/derivação pura.
- Cuidado explícito: a sincronização **não** pode passar por
  `replace_buyers`; deve ser só inserção com `ON CONFLICT DO NOTHING`, senão
  apaga edições e linhas a cada refresh.
