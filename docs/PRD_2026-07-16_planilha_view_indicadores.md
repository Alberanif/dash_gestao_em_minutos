# PRD — Visualização "Planilha" no Dashboard Indicadores

**Date:** 2026-07-16
**Status:** Approved (decisões validadas em entrevista com o owner)
**Owner:** Alberani

## 1. Contexto e problema

O dashboard Indicadores (`/indicadores`) exibe os dados de um lançamento (Evento) em cards visuais: hero KPIs, funil, Meta Ads, Hotmart e captação de leads. O time de gestão, porém, acompanha lançamentos em planilhas de performance (ex.: "INDICADORES PERFORMANCE PC AO VIVO"), onde as métricas aparecem em linhas e a evolução **semana a semana** aparece em colunas. Hoje esse acompanhamento é feito manualmente fora do sistema.

**Objetivo:** oferecer, dentro do próprio dashboard, uma visualização em formato de planilha dos mesmos dados que os cards já exibem, com quebra semanal — eliminando a transcrição manual.

## 2. Escopo

### Incluído (v1)

- Nova visualização **"Planilha"** dentro de `/indicadores`, selecionável via abas "Dashboard | Planilha".
- Disponível automaticamente para **todos os Eventos** — existentes e futuros. A visualização é função do Evento ativo e do período selecionado; não há nada a "criar" por evento.
- Tabela com 4 blocos de linhas (Resumo, Meta Ads, Leads por origem, Vendas por origem) e colunas de Total do período + uma coluna por semana.
- Apenas dados **realizados**.

### Fora de escopo (v1)

| Item | Motivo |
|---|---|
| Colunas META / DIFERENÇA | Exige cadastro de metas por evento (tabela, CRUD, UI) — feature futura separada |
| Google Ads | Fonte de dados inexistente no sistema; seria uma integração inteira |
| Exportação CSV | Decisão do owner: só visualização em tela na v1 |
| Lembrar última aba usada | Ao entrar na página, abre sempre no Dashboard |
| Lista fixa de origens (como no CSV de referência) | Origens são dinâmicas, derivadas dos dados reais |

## 3. Experiência do usuário

### 3.1 Navegação

1. No cabeçalho de `/indicadores`, um seletor de abas **"Dashboard | Planilha"** troca o corpo da página.
2. O estado da aba é refletido na URL (`?view=planilha`) para permitir links compartilháveis. Sem o parâmetro (ou com valor inválido), abre no Dashboard.
3. **Evento ativo e período são compartilhados** entre as abas: trocar de aba não reseta o Evento, os presets nem as datas. Os controles existentes de período (presets 7d/28d/90d/mês + data inicial e final) continuam no cabeçalho e valem para as duas visualizações — é por eles que o usuário escolhe o dia inicial e final da Planilha.
4. Sem Evento ativo, a aba Planilha exibe o mesmo empty state do Dashboard (selecionar/criar um Evento).

### 3.2 Estrutura da tabela

**Colunas** (da esquerda para a direita):

| Coluna | Conteúdo |
|---|---|
| Métrica | Nome da linha (com unidade: R$, n°, %) |
| **Total** | Valor consolidado do período selecionado |
| Semana 1 … Semana N | Valor de cada semana, com o intervalo de datas no cabeçalho (ex.: "Semana 2 · 02/07 – 08/07") |

**Regra de semanas — quinta → quarta (decisão do owner):**

- Semanas são sempre demarcadas por **quinta-feira (início) até quarta-feira (fim)**.
- **Semana 1 parcial:** se a data inicial do período não for quinta, a Semana 1 vai da data inicial até a primeira quarta-feira (1 a 6 dias).
- **Última semana parcial:** termina na data final selecionada, mesmo que antes da quarta.
- Todos os dias do período pertencem a exatamente uma semana; nenhum dado é descartado.
- Exemplo: período 06/07 (segunda) a 22/07 → Semana 1: 06/07–08/07 (qua), Semana 2: 09/07 (qui)–15/07 (qua), Semana 3: 16/07 (qui)–22/07.

**Blocos de linhas** (de cima para baixo):

**Bloco 1 — Resumo (norteadoras)**

| Linha | Fonte / cálculo |
|---|---|
| ROAS | `calcROAS` (receita Hotmart ÷ investimento Meta), recalculado por coluna |
| Receita BRL | `total_revenue` (Hotmart) |
| Total de Vendas | `total_sales` (Hotmart) |

**Bloco 2 — Meta Ads** (os 8 KPIs do card atual)

| Linha | Campo |
|---|---|
| Investimento | `meta_spend` |
| Leads Gerados | `meta_leads` |
| CPM | `meta_cpm` |
| CTR | `meta_ctr` |
| CPL Tráfego | `meta_cpl_traffic` |
| Connect Rate | `meta_connect_rate` |
| Conv. LP | `meta_lp_conversion` |
| Checkout | `meta_checkout` |

**Bloco 3 — Leads por origem**

- Uma linha por origem presente nos dados do período (`GlobalLeadsMetrics.by_source`), ordenadas da maior para a menor pelo Total.
- Linha final: **Total de Leads**.
- Origens com zero leads no período inteiro não aparecem.

**Bloco 4 — Vendas por origem**

- Uma linha por `utm_source` presente nas vendas do período (`ConversionSourceRow`), ordenadas da maior para a menor pelo Total.
- Linha final: **Total de Vendas**.

### 3.3 Formatação

- Reusar os formatters do dashboard: moeda `pt-BR` BRL, números `pt-BR` sem decimais, percentuais com 2 casas.
- Valores não calculáveis (divisão por zero, fonte sem dados na semana) exibem `—`, nunca `Infinity`, `NaN` ou `0` enganoso — mesma convenção dos cards.
- Tabela larga (muitas semanas) rola horizontalmente dentro do próprio container, com a coluna "Métrica" fixa (sticky) à esquerda.

### 3.4 Fontes não configuradas

Comportamento idêntico ao Dashboard: se o Evento não tem Meta Ads / Hotmart / captação de leads configurados, o bloco correspondente **aparece na planilha** com valores zerados/`—` e o aviso "não configurado neste filtro — dados zerados". A estrutura de blocos é sempre a mesma para qualquer evento.

## 4. Requisitos funcionais

- **RF-1** — A aba Planilha exibe os 4 blocos de linhas na ordem: Resumo, Meta Ads, Leads por origem, Vendas por origem.
- **RF-2** — Cada linha exibe o valor Total do período e um valor por semana (regra quinta→quarta, parciais nas pontas).
- **RF-3** — Métricas de razão (ROAS, CPM, CTR, CPL, Connect Rate, Conv. LP) são **recalculadas por coluna a partir dos valores brutos daquela coluna** (ex.: CPL da Semana 2 = investimento da Semana 2 ÷ leads da Semana 2). Nunca média das médias, nunca soma de percentuais.
- **RF-4** — A soma dos valores semanais de métricas aditivas (investimento, leads, vendas, receita) deve bater com a coluna Total.
- **RF-5** — Alterar Evento, preset ou datas no cabeçalho atualiza a Planilha, exatamente como atualiza o Dashboard.
- **RF-6** — Trocar de aba não dispara refetch se Evento e período não mudaram (reusar os dados já carregados quando possível; o detalhamento semanal pode exigir chamada própria).
- **RF-7** — Estados de carregamento (skeleton), erro por bloco e empty state seguem os padrões visuais existentes do módulo.

## 5. Requisitos técnicos

### 5.1 APIs — quebra semanal (principal mudança de backend)

Hoje os endpoints devolvem apenas agregados do período:

| Endpoint | Devolve hoje | Precisa passar a suportar |
|---|---|---|
| `/api/indicadores/metrics` (Meta) | `GlobalMetrics` agregado | Valores brutos por sub-período semanal |
| `/api/indicadores/hotmart` | Totais de vendas/receita | Vendas e receita por sub-período |
| `/api/indicadores/leads` | `by_source` agregado | Leads por origem por sub-período |
| `/api/indicadores/conversion-sources` | `ConversionSourceRow[]` agregado | Vendas por origem por sub-período |

Abordagem sugerida (a validar no plano de implementação): um parâmetro de query com os cortes semanais (ou `breakdown=weekly` calculado no servidor a partir de `startDate`/`endDate` com a regra quinta→quarta), devolvendo, além do agregado atual, um array `weeks[]` com os mesmos campos por semana. Manter o shape atual intacto para não quebrar o Dashboard.

A regra de particionamento em semanas (quinta→quarta com parciais) deve viver em **um único módulo compartilhado** (`src/lib/`), usado tanto pelo front (cabeçalhos das colunas) quanto pelas APIs (cortes das queries), respeitando o timezone já tratado em `src/lib/indicadores/timezone.ts`.

### 5.2 Frontend

- Novo componente de visualização (ex.: `src/components/indicadores/planilha-view.tsx`) renderizado por `src/app/indicadores/page.tsx` quando `view=planilha`.
- Seletor de abas no cabeçalho, sincronizado com o query param `view` (sem recarregar a página).
- Filtros por fonte não configurada seguem `expandFilter` — mesma lógica de escopo do Dashboard.
- Antes de codificar, ler os guias em `node_modules/next/dist/docs/` (convenção do projeto — esta versão do Next.js tem breaking changes).

## 6. Critérios de aceite

1. Com um Evento ativo e período 06/07–22/07 selecionado, a aba Planilha mostra 3 colunas semanais: 06–08/07, 09–15/07 (qui–qua) e 16–22/07, mais a coluna Total.
2. Para cada métrica aditiva, a soma das colunas semanais é igual à coluna Total.
3. O CPL exibido na coluna Total é igual ao CPL do card Meta Ads do Dashboard para o mesmo Evento/período; idem para os demais KPIs.
4. As origens de leads e de vendas listadas batem com as dos cards do Dashboard (mesmos dados, sem corte de top-N — a planilha lista todas).
5. Evento sem Hotmart configurado: blocos Resumo (parcial), Vendas por origem aparecem zerados com aviso de não configurado, sem erro.
6. URL `/indicadores?view=planilha` abre direto na Planilha; `/indicadores` abre no Dashboard.
7. Trocar preset ou datas com a Planilha aberta recalcula colunas e valores; voltar ao Dashboard mantém o mesmo período.

## 7. Riscos e pontos de atenção

- **Volume de colunas:** período de 90 dias ≈ 14 semanas. A tabela deve rolar horizontalmente sem quebrar o layout; avaliar performance de render só se houver sintoma.
- **Consistência Total × semanas:** métricas de razão calculadas em pontas diferentes (server para Total, client para semanas, ou vice-versa) podem divergir por arredondamento. Calcular tudo a partir dos mesmos valores brutos, no mesmo lugar.
- **Timezone:** cortes de semana devem usar a mesma convenção de timezone das queries atuais (`timezone.ts`); um corte errado desloca dados entre semanas vizinhas.
- **Leads "dados não filtrados":** o bloco de leads segue o escopo atual do endpoint de leads (filtra só por evento de captação, não por produto/termo/oferta) — mesmo comportamento do card do Dashboard.

## 8. Decisões registradas (entrevista de 2026-07-16)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Metas (META/DIFERENÇA) | Fora da v1 — só REALIZADO |
| 2 | Quebra temporal das colunas | Total + colunas semanais |
| 3 | Definição de semana | Sempre quinta-feira → quarta-feira |
| 4 | Dias soltos antes da 1ª quinta | Semana 1 parcial (data inicial → 1ª quarta) |
| 5 | Onde vive a Planilha | Abas dentro de `/indicadores`, estado em `?view=`, Evento e período compartilhados |
| 6 | Linhas de origem | Dinâmicas dos dados reais, ordenadas desc, com linha de Total por bloco |
| 7 | Blocos | Resumo (ROAS, Receita, Vendas) + Meta Ads + Leads por origem + Vendas por origem; sem Google Ads |
| 8 | Visualização padrão | Sempre Dashboard ao entrar |
| 9 | Exportação | Fora da v1 |
| 10 | Fonte não configurada | Bloco aparece zerado com aviso (igual ao Dashboard) |
