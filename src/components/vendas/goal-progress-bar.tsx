import { fmtPercent1 } from "@/lib/vendas/format";

interface GoalProgressBarProps {
  goalPercent: number;
  currentPercent: number;
}

// Barra de meta (PRD issue #114, seção 3.2, critério 9) — o pai só monta
// este componente quando cycle.goal_percent está cadastrada; não há estado
// "sem meta" aqui de propósito.
export function GoalProgressBar({ goalPercent, currentPercent }: GoalProgressBarProps) {
  const clampedWidth = Math.min(100, Math.max(0, currentPercent));
  const reachedGoal = currentPercent >= goalPercent;

  return (
    <div
      data-testid="ultimates-goal-bar"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderRadius: 11,
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>
          Meta {fmtPercent1(goalPercent)}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: reachedGoal ? "var(--green)" : "var(--text-muted)",
          }}
        >
          {fmtPercent1(currentPercent)} renovados
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: 999,
          background: "var(--surface-2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${clampedWidth}%`,
            borderRadius: 999,
            background: reachedGoal ? "var(--green)" : "var(--blue)",
            transition: "width 200ms ease",
          }}
        />
        {goalPercent >= 0 && goalPercent <= 100 && (
          <div
            title={`Meta: ${fmtPercent1(goalPercent)}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${Math.min(100, Math.max(0, goalPercent))}%`,
              width: 2,
              background: "var(--text-2)",
              opacity: 0.7,
            }}
          />
        )}
      </div>
    </div>
  );
}
