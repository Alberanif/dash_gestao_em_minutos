# Comparativo Hotmart Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar seção "Hotmart" em cada coluna de período do Comparativo exibindo vendas BRL, faturamento e vendas em moeda estrangeira separados.

**Architecture:** `ComparativoPeriod` ganha três novos campos Hotmart; `fetchMetrics` dispara `Promise.all` com `/metrics` + `/hotmart-metrics`; `FilledSlot` renderiza a nova seção abaixo dos grupos existentes.

**Tech Stack:** Next.js, React (hooks), TypeScript

---

## Files

| Arquivo | Ação |
|---------|------|
| `src/types/indicadores.ts` | Modify — adicionar campos Hotmart em `ComparativoPeriod` |
| `src/components/indicadores/comparativo-tab.tsx` | Modify — `fetchMetrics` paralelo + seção Hotmart em `FilledSlot` |

---

### Task 1: Atualizar tipo `ComparativoPeriod`

**Files:**
- Modify: `src/types/indicadores.ts`

- [ ] **Step 1: Abrir o arquivo e localizar a interface**

```
src/types/indicadores.ts, linha 49:
export interface ComparativoPeriod {
  startDate: string;
  endDate: string;
  metrics: IndicadoresMetrics | null;
  loading: boolean;
  error: boolean;
}
```

- [ ] **Step 2: Adicionar campos Hotmart**

Substituir a interface inteira por:

```ts
export interface ComparativoPeriod {
  startDate: string;
  endDate: string;
  metrics: IndicadoresMetrics | null;
  loading: boolean;
  error: boolean;
  hotmartMetrics: HotmartMetrics | null;
  hotmartLoading: boolean;
  hotmartError: boolean;
}
```

- [ ] **Step 3: Verificar que o TypeScript não quebrou**

```bash
cd /Users/alberanif/Documents/IGT/DASH_GESTAO/dash_gestao_em_minutos
npx tsc --noEmit 2>&1 | head -30
```

Esperado: erros em `comparativo-tab.tsx` porque o estado inicial não inclui os novos campos (serão corrigidos na próxima task). Não deve haver outros erros.

- [ ] **Step 4: Commit**

```bash
git add src/types/indicadores.ts
git commit -m "feat(comparativo): add Hotmart fields to ComparativoPeriod type"
```

---

### Task 2: Atualizar `fetchMetrics` para buscar Hotmart em paralelo

**Files:**
- Modify: `src/components/indicadores/comparativo-tab.tsx`

- [ ] **Step 1: Localizar a função `fetchMetrics` (linha ~93)**

A função atual busca apenas `/metrics`. Precisamos:
1. Inicializar o estado com os campos Hotmart
2. Disparar `Promise.all` com as duas requisições
3. Tratar sucesso e erro de cada uma independentemente

- [ ] **Step 2: Substituir a função `fetchMetrics` completa**

```ts
const fetchMetrics = useCallback(
  async (index: number, start: string, end: string) => {
    setPeriods((prev) => {
      const next = [...prev];
      next[index] = {
        startDate: start,
        endDate: end,
        metrics: null,
        loading: true,
        error: false,
        hotmartMetrics: null,
        hotmartLoading: true,
        hotmartError: false,
      };
      return next;
    });

    const params = new URLSearchParams({ start_date: start, end_date: end });

    const [metricsRes, hotmartRes] = await Promise.allSettled([
      fetch(`/api/indicadores/projects/${projectId}/metrics?${params}`),
      fetch(`/api/indicadores/projects/${projectId}/hotmart-metrics?${params}`),
    ]);

    setPeriods((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return next;

      // Metrics result
      let metrics: IndicadoresMetrics | null = null;
      let metricsError = false;
      if (metricsRes.status === "fulfilled" && metricsRes.value.ok) {
        try {
          const data = await metricsRes.value.json();
          metrics = data.error ? null : data;
          metricsError = !!data.error;
        } catch {
          metricsError = true;
        }
      } else {
        metricsError = true;
      }

      // Hotmart result
      let hotmartMetrics: HotmartMetrics | null = null;
      let hotmartError = false;
      if (hotmartRes.status === "fulfilled" && hotmartRes.value.ok) {
        try {
          const data = await hotmartRes.value.json();
          hotmartMetrics = data.error ? null : data;
          hotmartError = !!data.error;
        } catch {
          hotmartError = true;
        }
      } else {
        hotmartError = true;
      }

      next[index] = {
        ...current,
        metrics,
        loading: false,
        error: metricsError,
        hotmartMetrics,
        hotmartLoading: false,
        hotmartError,
      };
      return next;
    });
  },
  [projectId]
);
```

**Problema:** `Promise.allSettled` + `setPeriods` com `await` dentro do setter não funciona — setters do React são síncronos. Precisamos resolver as Promises antes de chamar `setPeriods`.

- [ ] **Step 3: Implementação correta com resolução antes do setter**

```ts
const fetchMetrics = useCallback(
  async (index: number, start: string, end: string) => {
    setPeriods((prev) => {
      const next = [...prev];
      next[index] = {
        startDate: start,
        endDate: end,
        metrics: null,
        loading: true,
        error: false,
        hotmartMetrics: null,
        hotmartLoading: true,
        hotmartError: false,
      };
      return next;
    });

    const params = new URLSearchParams({ start_date: start, end_date: end });

    const [metricsResult, hotmartResult] = await Promise.allSettled([
      fetch(`/api/indicadores/projects/${projectId}/metrics?${params}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch(`/api/indicadores/projects/${projectId}/hotmart-metrics?${params}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ]);

    const metrics =
      metricsResult.status === "fulfilled" && !metricsResult.value.error
        ? (metricsResult.value as IndicadoresMetrics)
        : null;
    const metricsError =
      metricsResult.status === "rejected" ||
      !!metricsResult.value?.error;

    const hotmartMetrics =
      hotmartResult.status === "fulfilled" && !hotmartResult.value.error
        ? (hotmartResult.value as HotmartMetrics)
        : null;
    const hotmartError =
      hotmartResult.status === "rejected" ||
      !!hotmartResult.value?.error;

    setPeriods((prev) => {
      const next = [...prev];
      next[index] = {
        startDate: start,
        endDate: end,
        metrics,
        loading: false,
        error: metricsError,
        hotmartMetrics,
        hotmartLoading: false,
        hotmartError,
      };
      return next;
    });
  },
  [projectId]
);
```

- [ ] **Step 4: Adicionar import de `HotmartMetrics` no topo do arquivo**

O import atual é:
```ts
import type { IndicadoresMetrics, ComparativoPeriod } from "@/types/indicadores";
```

Alterar para:
```ts
import type { IndicadoresMetrics, ComparativoPeriod, HotmartMetrics } from "@/types/indicadores";
```

- [ ] **Step 5: Atualizar `clearPeriod` para resetar campos Hotmart**

A função `clearPeriod` apenas seta `null` no índice, o que já está correto — um `null` no array significa slot vazio. Nenhuma mudança necessária.

- [ ] **Step 6: Atualizar `onRetry` para rebuscar Hotmart também**

O botão "Tentar novamente" existente já chama `fetchMetrics(index, period.startDate, period.endDate)`, o que rebuscará ambas as APIs. Nenhuma mudança necessária.

- [ ] **Step 7: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros (ou apenas erros de `FilledSlot` que ainda não renderiza Hotmart).

- [ ] **Step 8: Commit**

```bash
git add src/components/indicadores/comparativo-tab.tsx src/types/indicadores.ts
git commit -m "feat(comparativo): fetch Hotmart metrics in parallel per period"
```

---

### Task 3: Renderizar seção Hotmart em `FilledSlot`

**Files:**
- Modify: `src/components/indicadores/comparativo-tab.tsx`

- [ ] **Step 1: Atualizar props de `FilledSlot`**

Adicionar `onRetryHotmart` nas props:

```ts
function FilledSlot({
  period,
  projectName,
  onEditDates,
  onClear,
  onRetry,
  onRetryHotmart,
}: {
  period: ComparativoPeriod;
  projectName: string;
  onEditDates: () => void;
  onClear: () => void;
  onRetry: () => void;
  onRetryHotmart: () => void;
})
```

- [ ] **Step 2: Passar `onRetryHotmart` no local onde `FilledSlot` é usado**

No `ComparativoTab`, o `FilledSlot` é renderizado assim (linha ~172):

```tsx
<FilledSlot
  key={index}
  period={period}
  projectName={projectName}
  onEditDates={() => setModalIndex(index)}
  onClear={() => clearPeriod(index)}
  onRetry={() => fetchMetrics(index, period.startDate, period.endDate)}
/>
```

Adicionar `onRetryHotmart`:

```tsx
<FilledSlot
  key={index}
  period={period}
  projectName={projectName}
  onEditDates={() => setModalIndex(index)}
  onClear={() => clearPeriod(index)}
  onRetry={() => fetchMetrics(index, period.startDate, period.endDate)}
  onRetryHotmart={() => fetchMetrics(index, period.startDate, period.endDate)}
/>
```

(Ambos re-disparam `fetchMetrics` completo, o que é correto — simples e consistente.)

- [ ] **Step 3: Adicionar helper para calcular vendas estrangeiras**

Acima da função `FilledSlot`, adicionar:

```ts
function calcHotmartSales(metrics: HotmartMetrics) {
  const foreignSales = metrics.products
    .filter((p) => p.is_foreign_currency)
    .reduce((s, p) => s + p.sales_count, 0);
  const brlSales = metrics.total_sales - foreignSales;
  return { brlSales, foreignSales, totalRevenue: metrics.total_revenue };
}
```

- [ ] **Step 4: Renderizar a seção Hotmart no body do `FilledSlot`**

No `FilledSlot`, dentro do bloco que renderiza os `KPI_GROUPS` (após o último `</div>` do `KPI_GROUPS.map`), adicionar a seção Hotmart:

```tsx
{/* Seção Hotmart */}
{(period.hotmartLoading || period.hotmartError || period.hotmartMetrics) && (
  <div>
    <p
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: "#F04E23",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 6,
      }}
    >
      Hotmart
    </p>

    {period.hotmartError ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
        <p style={{ fontSize: 12, color: "var(--color-danger)" }}>
          Erro ao carregar Hotmart
        </p>
        <button
          onClick={onRetryHotmart}
          style={{
            fontSize: 12,
            color: "var(--color-primary)",
            background: "none",
            border: "1px solid var(--color-primary)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 10px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Tentar novamente
        </button>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { label: "Vendas (BRL)", getValue: (m: HotmartMetrics) => fmtNum(calcHotmartSales(m).brlSales) },
          { label: "Faturamento", getValue: (m: HotmartMetrics) => fmtBRL(calcHotmartSales(m).totalRevenue) },
          { label: "Vendas Ext.", getValue: (m: HotmartMetrics) => fmtNum(calcHotmartSales(m).foreignSales) },
        ].map(({ label, getValue }) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "5px 8px",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-bg)",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {label}
            </span>
            {period.hotmartLoading ? (
              <div
                className="animate-pulse"
                style={{
                  height: 12,
                  width: 48,
                  borderRadius: 4,
                  background: "var(--color-border)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--color-text)",
                  fontFamily: "monospace",
                  flexShrink: 0,
                }}
              >
                {period.hotmartMetrics ? getValue(period.hotmartMetrics) : "—"}
              </span>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros.

- [ ] **Step 6: Testar manualmente no browser**

```bash
npm run dev
```

Abrir `http://localhost:3000/indicadores`, entrar em um projeto, ir na aba "Comparativo", adicionar um período e verificar:
- Seção "HOTMART" aparece abaixo de "Leads Orgânicos"
- Skeleton aparece durante loading
- Dados corretos após carregar
- Se o projeto não tiver `hotmart_product_ids`, a seção não aparece

- [ ] **Step 7: Commit**

```bash
git add src/components/indicadores/comparativo-tab.tsx
git commit -m "feat(comparativo): add Hotmart section with BRL/foreign sales breakdown"
```

---

## Self-Review

**Spec coverage:**
- ✅ Seção Hotmart em cada coluna de período
- ✅ Total de vendas BRL separado de estrangeiras (opção C escolhida)
- ✅ Total faturado BRL em R$
- ✅ Cor accent Hotmart (#F04E23)
- ✅ Loading skeleton nas 3 linhas
- ✅ Erro com retry independente
- ✅ Projeto sem Hotmart configurado não exibe a seção

**Placeholder scan:** Nenhum TBD ou TODO encontrado.

**Type consistency:** `HotmartMetrics` importado em Task 2 e reutilizado em Task 3. `calcHotmartSales` definido antes de `FilledSlot` e usado internamente. `ComparativoPeriod` atualizado em Task 1 e consumido em Tasks 2 e 3.
