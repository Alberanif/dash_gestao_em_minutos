# Comparativo — Seção Hotmart

**Data:** 2026-04-22  
**Feature:** Indicadores › Comparativo

---

## Objetivo

Adicionar uma seção "Hotmart" em cada coluna de período do Comparativo, exibindo:
- Total de vendas em BRL
- Total faturado em BRL (R$)
- Total de vendas em moeda estrangeira (separado)

---

## Arquitetura

### Fluxo de dados

Quando o usuário seleciona um período, `fetchMetrics` dispara duas requisições **paralelas** com `Promise.all`:

1. `GET /api/indicadores/projects/{id}/metrics?start_date=&end_date=` — já existente
2. `GET /api/indicadores/projects/{id}/hotmart-metrics?start_date=&end_date=` — já existente

O estado de cada período armazena os resultados separadamente.

### Mudanças de tipo (`src/types/indicadores.ts`)

Adicionar campos em `ComparativoPeriod`:

```ts
hotmartMetrics: HotmartMetrics | null;
hotmartLoading: boolean;
hotmartError: boolean;
```

`HotmartMetrics` já existe e expõe:
- `total_sales: number` — soma de vendas BRL + estrangeiras
- `total_revenue: number` — soma do revenue somente BRL
- `products: HotmartProductMetrics[]` — por produto

Para calcular vendas estrangeiras no frontend:
```ts
const foreignSales = metrics.products
  .filter(p => p.is_foreign_currency)
  .reduce((s, p) => s + p.sales_count, 0);

const brlSales = metrics.total_sales - foreignSales;
```

---

## Componente `ComparativoTab`

### Estado

```ts
const [periods, setPeriods] = useState<(ComparativoPeriod | null)[]>([null, null, null, null]);
```

`ComparativoPeriod` passa a ter os campos adicionais de Hotmart.

### `fetchMetrics` (atualizado)

Inicializa o período com `hotmartLoading: true, hotmartError: false, hotmartMetrics: null`.

Dispara `Promise.all` com as duas requisições. Cada resultado é aplicado ao estado independentemente — se o fetch de Hotmart falhar, a coluna ainda mostra as métricas de Ads.

### `FilledSlot` — nova seção Hotmart

Abaixo dos grupos existentes (Meta Ads, Google Ads, Leads Orgânicos), adicionar grupo com:

- **Cor accent:** `#F04E23` (brand Hotmart)
- **Label do grupo:** `HOTMART`
- **Linhas:**
  - "Vendas (BRL)" → `brlSales` formatado como número inteiro
  - "Faturamento" → `total_revenue` formatado como `R$ X.XXX,XX`
  - "Vendas Ext." → `foreignSales` formatado como número inteiro

Se `hotmartLoading`, exibe skeleton pulse nas 3 linhas.  
Se `hotmartError`, exibe mensagem de erro com botão "Tentar novamente" (dispara novo fetch somente para Hotmart).  
Se `hotmartMetrics === null` e não loading/error (projeto sem produtos Hotmart configurados), não exibe a seção.

---

## Tratamento de estados

| Estado | Comportamento |
|--------|--------------|
| loading | Skeleton pulse nas 3 linhas da seção Hotmart |
| error | Mensagem de erro + botão retry (somente Hotmart) |
| sem produtos | Seção Hotmart não renderizada |
| normal | Exibe as 3 linhas com dados |

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/types/indicadores.ts` | Adicionar `hotmartMetrics`, `hotmartLoading`, `hotmartError` em `ComparativoPeriod` |
| `src/components/indicadores/comparativo-tab.tsx` | `fetchMetrics` com `Promise.all`, `FilledSlot` com seção Hotmart |

Nenhuma mudança necessária nas APIs (já existem e retornam os dados corretos).
