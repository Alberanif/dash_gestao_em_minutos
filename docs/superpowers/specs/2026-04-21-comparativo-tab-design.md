# Aba Comparativo — Indicadores

**Data:** 2026-04-21  
**Módulo:** `src/app/indicadores/[id]`  
**Status:** Aprovado

## Objetivo

Adicionar uma aba "Comparativo" na página de detalhe de cada projeto do módulo Indicadores, permitindo ao usuário selecionar até 4 períodos distintos e comparar os KPIs lado a lado em layout de colunas.

## Arquitetura

### Abordagem escolhida
Componente separado (Opção B): a lógica da aba vive em `src/components/indicadores/comparativo-tab.tsx`. A página `[id]/page.tsx` adiciona um sistema de tabs e renderiza o componente.

### Arquivos impactados

| Arquivo | Ação |
|---|---|
| `src/app/indicadores/[id]/page.tsx` | Adicionar tabs "Visão Geral" / "Comparativo"; renderizar `<ComparativoTab>` |
| `src/components/indicadores/comparativo-tab.tsx` | **Novo** — toda a lógica da aba |
| `src/types/indicadores.ts` | Adicionar tipo `ComparativoPeriod` |

### Sem novas rotas de API
O endpoint existente `/api/indicadores/projects/[id]/metrics?start_date=&end_date=` já entrega todas as métricas necessárias. Será chamado em paralelo, uma vez por slot preenchido.

## Tipos

```ts
interface ComparativoPeriod {
  id: number;                        // 1–4, posição fixa no array
  startDate: string;                 // YYYY-MM-DD
  endDate: string;                   // YYYY-MM-DD
  metrics: IndicadoresMetrics | null;
  loading: boolean;
  error: boolean;
}
```

Estado no componente: `periods: (ComparativoPeriod | null)[]` — array de 4 posições, `null` representa slot vazio.

## Comportamento dos slots

### Slot vazio
- Card com borda tracejada, altura mínima ~400px
- Ícone "+" centralizado com texto "Adicionar período"
- Cursor pointer; hover escurece levemente o fundo
- Clicar abre o modal de seleção de datas

### Slot preenchido
- **Cabeçalho:** nome do projeto + datas clicáveis (formato `DD/MM – DD/MM`) + botão "×" no canto direito
- Clicar nas datas reabre o modal para editar o período
- Clicar em "×" limpa o slot (volta para `null`)
- **Corpo:** lista vertical de KPI rows agrupadas por seção

### Modal de seleção de datas
- Dois inputs `type="date"` (início e fim)
- Validação no cliente: início não pode ser maior que fim
- Botões "Salvar" e "Cancelar"
- Estilo visual inline, seguindo o padrão existente no projeto (bordas, border-radius, cores de variável CSS)

### Fetch de métricas
- Ao salvar, o slot entra em `loading: true` e faz fetch para `/metrics`
- Fetch de cada slot é independente — não bloqueia nem aguarda outros slots
- Em caso de erro da API: `error: true`, exibe mensagem "Erro ao carregar dados" + botão "Tentar novamente"

## Layout da visualização

```
[ Slot 1          ] [ Slot 2          ] [ Slot 3          ] [ Slot 4          ]
[ Nome do Projeto ] [ Nome do Projeto ] [       +         ] [       +         ]
[ 01/03 – 31/03 ×] [ 01/04 – 21/04 ×]                    
─────────────────   ─────────────────
Meta Ads            Meta Ads
  Investimento R$…    Investimento R$…
  CPM          R$…    CPM          R$…
  CTR          …%     CTR          …%
  Leads        …      Leads        …
  Connect Rate …%     Connect Rate …%
  CPL Tráfego  R$…    CPL Tráfego  R$…
  Conversão LP …%     Conversão LP …%
Google Ads          Google Ads
  Investimento R$…    ...
  ...
Leads Orgânicos     Leads Orgânicos
  Leads Org.   …      ...
  Leads Desc.  …      ...
```

- Layout horizontal com `display: grid; grid-template-columns: repeat(4, minmax(200px, 1fr))`
- `overflow-x: auto` no container para scroll em telas menores
- KPIs sem dado exibem "—"
- Durante loading: skeleton nas células de valor (mesmo padrão do `KpiBox` existente)

## Edge cases

- **Início > fim:** bloqueado no modal antes do submit
- **4 slots preenchidos:** slots vazios inexistentes — nenhum "+" disponível
- **Erro de API:** exibe estado de erro por slot, com retry individual
- **Navegação:** estado é volátil — resetado ao sair da página (sem persistência)

## KPIs exibidos (todas as métricas da aba principal)

**Meta Ads:** Investimento, CPM, CTR, Leads, Connect Rate, CPL Tráfego, Conversão LP  
**Google Ads:** Investimento, CPM, Leads Total, Connect Rate, CPL Tráfego, Conversão LP  
**Leads Orgânicos:** Leads Orgânicos, Leads Desconhecidos
