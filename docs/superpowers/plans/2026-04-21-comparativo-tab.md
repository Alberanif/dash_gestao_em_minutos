# Comparativo Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Comparativo" tab to each Indicadores project page, letting users pick up to 4 date ranges and compare all KPIs side-by-side in a column layout.

**Architecture:** A new `ComparativoTab` component holds all slot state (4 positions, each `null` or a filled period). A `PeriodDateModal` handles date selection. The existing `/api/indicadores/projects/[id]/metrics` endpoint is called in parallel per filled slot — no new API routes needed. The project detail page gains a tab bar that toggles between the existing "Visão Geral" content and the new component.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, inline CSS variables (`var(--color-*)`) matching existing project style, no new dependencies.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/indicadores.ts` | Modify | Add `ComparativoPeriod` type |
| `src/components/indicadores/period-date-modal.tsx` | Create | Date range picker modal |
| `src/components/indicadores/comparativo-tab.tsx` | Create | 4-slot comparison layout + fetch logic |
| `src/app/indicadores/[id]/page.tsx` | Modify | Add tab bar, render `ComparativoTab` |

---

## Task 1: Add `ComparativoPeriod` type

**Files:**
- Modify: `src/types/indicadores.ts`

- [ ] **Step 1: Add the type**

Open `src/types/indicadores.ts` and append after the `IndicadoresMetrics` interface:

```ts
export interface ComparativoPeriod {
  startDate: string;
  endDate: string;
  metrics: IndicadoresMetrics | null;
  loading: boolean;
  error: boolean;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/indicadores.ts
git commit -m "feat(indicadores): add ComparativoPeriod type"
```

---

## Task 2: Create `PeriodDateModal` component

**Files:**
- Create: `src/components/indicadores/period-date-modal.tsx`

- [ ] **Step 1: Create the file with the full component**

```tsx
"use client";

import { useState } from "react";

interface PeriodDateModalProps {
  initialStart?: string;
  initialEnd?: string;
  onSave: (start: string, end: string) => void;
  onCancel: () => void;
}

export function PeriodDateModal({
  initialStart = "",
  initialEnd = "",
  onSave,
  onCancel,
}: PeriodDateModalProps) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [error, setError] = useState("");

  function handleSave() {
    if (!start || !end) {
      setError("Selecione as duas datas.");
      return;
    }
    if (start > end) {
      setError("A data de início deve ser anterior à data de fim.");
      return;
    }
    onSave(start, end);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: 24,
          width: 340,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--color-text)",
          }}
        >
          Selecionar período
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text-muted)",
              }}
            >
              Data de início
            </span>
            <input
              type="date"
              className="field-control"
              style={{ fontSize: 13, height: 36 }}
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setError("");
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text-muted)",
              }}
            >
              Data de fim
            </span>
            <input
              type="date"
              className="field-control"
              style={{ fontSize: 13, height: 36 }}
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setError("");
              }}
            />
          </label>

          {error && (
            <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "none",
              fontSize: 13,
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--color-primary)",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/indicadores/period-date-modal.tsx
git commit -m "feat(indicadores): add PeriodDateModal component"
```

---

## Task 3: Create `ComparativoTab` component

**Files:**
- Create: `src/components/indicadores/comparativo-tab.tsx`

- [ ] **Step 1: Create the file with the full component**

```tsx
"use client";

import { useState, useCallback } from "react";
import type { IndicadoresMetrics, ComparativoPeriod } from "@/types/indicadores";
import { PeriodDateModal } from "./period-date-modal";

function fmtBRL(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

type KpiItem = {
  label: string;
  key: keyof IndicadoresMetrics;
  fmt: (n: number | null | undefined) => string;
};

type KpiGroup = {
  group: string;
  accent: string;
  items: KpiItem[];
};

const KPI_GROUPS: KpiGroup[] = [
  {
    group: "Meta Ads",
    accent: "#1877f2",
    items: [
      { label: "Investimento", key: "meta_spend", fmt: fmtBRL },
      { label: "CPM", key: "meta_cpm", fmt: fmtBRL },
      { label: "CTR", key: "meta_ctr", fmt: fmtPct },
      { label: "Leads", key: "meta_leads", fmt: fmtNum },
      { label: "Connect Rate", key: "meta_connect_rate", fmt: fmtPct },
      { label: "CPL Tráfego", key: "meta_cpl_traffic", fmt: fmtBRL },
      { label: "Conversão LP", key: "meta_lp_conversion", fmt: fmtPct },
    ],
  },
  {
    group: "Google Ads",
    accent: "#34a853",
    items: [
      { label: "Investimento", key: "google_spend", fmt: fmtBRL },
      { label: "CPM", key: "google_cpm", fmt: fmtBRL },
      { label: "Leads Total", key: "google_leads", fmt: fmtNum },
      { label: "Connect Rate", key: "google_connect_rate", fmt: fmtPct },
      { label: "CPL Tráfego", key: "google_cpl_traffic", fmt: fmtBRL },
      { label: "Conversão LP", key: "google_lp_conversion", fmt: fmtPct },
    ],
  },
  {
    group: "Leads Orgânicos",
    accent: "#0891b2",
    items: [
      { label: "Leads Orgânicos", key: "organic_leads", fmt: fmtNum },
      { label: "Leads Desconhecidos", key: "unknown_leads", fmt: fmtNum },
    ],
  },
];

interface ComparativoTabProps {
  projectId: string;
  projectName: string;
}

export function ComparativoTab({ projectId, projectName }: ComparativoTabProps) {
  const [periods, setPeriods] = useState<(ComparativoPeriod | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [modalIndex, setModalIndex] = useState<number | null>(null);

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
        };
        return next;
      });
      try {
        const params = new URLSearchParams({
          start_date: start,
          end_date: end,
        });
        const res = await fetch(
          `/api/indicadores/projects/${projectId}/metrics?${params}`
        );
        const data: IndicadoresMetrics & { error?: string } = await res.json();
        setPeriods((prev) => {
          const next = [...prev];
          next[index] = {
            startDate: start,
            endDate: end,
            metrics: data.error ? null : data,
            loading: false,
            error: !!data.error,
          };
          return next;
        });
      } catch {
        setPeriods((prev) => {
          const next = [...prev];
          next[index] = {
            startDate: start,
            endDate: end,
            metrics: null,
            loading: false,
            error: true,
          };
          return next;
        });
      }
    },
    [projectId]
  );

  function handleSave(index: number, start: string, end: string) {
    setModalIndex(null);
    fetchMetrics(index, start, end);
  }

  function clearPeriod(index: number) {
    setPeriods((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  return (
    <div style={{ padding: "20px 24px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(200px, 1fr))",
          gap: 16,
          overflowX: "auto",
        }}
      >
        {periods.map((period, index) =>
          period === null ? (
            <EmptySlot key={index} onAdd={() => setModalIndex(index)} />
          ) : (
            <FilledSlot
              key={index}
              period={period}
              projectName={projectName}
              onEditDates={() => setModalIndex(index)}
              onClear={() => clearPeriod(index)}
              onRetry={() =>
                fetchMetrics(index, period.startDate, period.endDate)
              }
            />
          )
        )}
      </div>

      {modalIndex !== null && (
        <PeriodDateModal
          initialStart={periods[modalIndex]?.startDate ?? ""}
          initialEnd={periods[modalIndex]?.endDate ?? ""}
          onSave={(start, end) => handleSave(modalIndex, start, end)}
          onCancel={() => setModalIndex(null)}
        />
      )}
    </div>
  );
}

function EmptySlot({ onAdd }: { onAdd: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onAdd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        minHeight: 400,
        border: "2px dashed var(--color-border)",
        borderRadius: "var(--radius-card)",
        background: hovered ? "var(--color-surface)" : "var(--color-bg)",
        cursor: "pointer",
        transition: "background 0.15s",
        color: "var(--color-text-muted)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        +
      </div>
      <span style={{ fontSize: 12, fontWeight: 500 }}>Adicionar período</span>
    </button>
  );
}

function FilledSlot({
  period,
  projectName,
  onEditDates,
  onClear,
  onRetry,
}: {
  period: ComparativoPeriod;
  projectName: string;
  onEditDates: () => void;
  onClear: () => void;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        background: "var(--color-surface)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "relative",
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-text)",
            paddingRight: 24,
            lineHeight: 1.3,
          }}
        >
          {projectName}
        </p>
        <button
          onClick={onEditDates}
          title="Alterar período"
          style={{
            fontSize: 11,
            color: "var(--color-primary)",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            fontWeight: 600,
          }}
        >
          {formatDate(period.startDate)} – {formatDate(period.endDate)}
        </button>
        <button
          onClick={onClear}
          title="Remover período"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg)",
            color: "var(--color-text-muted)",
            fontSize: 14,
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px", flex: 1 }}>
        {period.error ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <p style={{ fontSize: 12, color: "#ef4444" }}>
              Erro ao carregar dados
            </p>
            <button
              onClick={onRetry}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {KPI_GROUPS.map(({ group, accent, items }) => (
              <div key={group}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                  }}
                >
                  {group}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {items.map(({ label, key, fmt }) => (
                    <div
                      key={key}
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
                      {period.loading ? (
                        <div
                          style={{
                            height: 12,
                            width: 48,
                            borderRadius: 4,
                            background: "var(--color-border)",
                            animation: "pulse 1.5s ease-in-out infinite",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color:
                              period.metrics?.[key] !== null &&
                              period.metrics?.[key] !== undefined
                                ? "var(--color-text)"
                                : "var(--color-text-muted)",
                            fontFamily: "monospace",
                            flexShrink: 0,
                          }}
                        >
                          {fmt(period.metrics?.[key] as number | null | undefined)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/indicadores/comparativo-tab.tsx
git commit -m "feat(indicadores): add ComparativoTab component"
```

---

## Task 4: Add tab navigation to `page.tsx`

**Files:**
- Modify: `src/app/indicadores/[id]/page.tsx`

- [ ] **Step 1: Add imports and `activeTab` state**

At the top of `src/app/indicadores/[id]/page.tsx`, add the import after the existing imports:

```tsx
import { ComparativoTab } from "@/components/indicadores/comparativo-tab";
```

Inside `ProjectDetailPage`, add the state after the existing `useState` declarations:

```tsx
const [activeTab, setActiveTab] = useState<"overview" | "comparativo">("overview");
```

- [ ] **Step 2: Wrap the date picker block with a conditional**

Find the `<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>` block that contains the date pickers and the loading spinner (currently the second div inside `<header>`). Wrap it so it only renders on the overview tab:

```tsx
{activeTab === "overview" && (
  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>De</span>
      <input
        type="date"
        className="field-control"
        style={{ fontSize: 13, width: 148, height: 36 }}
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />
    </label>
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>até</span>
      <input
        type="date"
        className="field-control"
        style={{ fontSize: 13, width: 148, height: 36 }}
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
      />
    </label>
    {loadingMetrics && (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--color-border)", borderTopColor: "var(--color-primary)", animation: "spin 0.7s linear infinite" }} />
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Atualizando…</span>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Add the tab bar between `</header>` and the content `<div>`**

After the closing `</header>` tag and before `{/* Content */}`, insert:

```tsx
{/* Tab bar */}
<div
  style={{
    display: "flex",
    gap: 0,
    padding: "0 24px",
    background: "var(--color-surface)",
    borderBottom: "1px solid var(--color-border)",
  }}
>
  {(["overview", "comparativo"] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      style={{
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 600,
        color:
          activeTab === tab
            ? "var(--color-primary)"
            : "var(--color-text-muted)",
        background: "none",
        border: "none",
        borderBottom:
          activeTab === tab
            ? "2px solid var(--color-primary)"
            : "2px solid transparent",
        cursor: "pointer",
        transition: "color 0.15s",
      }}
    >
      {tab === "overview" ? "Visão Geral" : "Comparativo"}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Wrap the overview content and add the Comparativo tab**

The current `{/* Content */}` block (the `<div style={{ padding: "20px 24px"... }}>` containing Meta Ads, Google Ads, Leads Orgânicos sections and the weekly table) must be wrapped in a conditional. Replace:

```tsx
{/* Content */}
<div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1000 }}>
  {/* ...all sections and table... */}
</div>
```

with:

```tsx
{activeTab === "overview" ? (
  <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1000 }}>
    {/* ...all sections and table — unchanged... */}
  </div>
) : (
  <ComparativoTab
    projectId={id}
    projectName={project?.name ?? ""}
  />
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Start the dev server and verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000/indicadores` and click into any project.

Verify:
1. Two tabs appear: "Visão Geral" and "Comparativo"
2. "Visão Geral" shows the existing layout (Meta Ads, Google Ads, etc.) unchanged — date pickers visible
3. Clicking "Comparativo" hides the date pickers and shows 4 empty slots with "+" buttons
4. Clicking a "+" opens the date selection modal
5. Entering início > fim shows a validation error; cannot save
6. Entering valid dates and clicking "Salvar" closes the modal, fills the slot with a loading skeleton, then shows the KPIs
7. Clicking the date text in the slot header reopens the modal with the current dates pre-filled; saving new dates reloads the metrics for that slot
8. Clicking "×" on a slot clears it back to the empty state
9. Filling all 4 slots: all 4 show data; no "+" buttons visible
10. Navigating away and back resets all slots to empty

- [ ] **Step 7: Commit**

```bash
git add src/app/indicadores/[id]/page.tsx
git commit -m "feat(indicadores): add Comparativo tab to project detail page"
```
