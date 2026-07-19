import { fmtPercent1 } from "@/lib/ultimates/format";

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
    <div data-testid="ultimates-goal-bar" className="surface-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
          Meta {fmtPercent1(goalPercent)}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: reachedGoal ? "var(--color-success)" : "var(--color-text-muted)",
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
          background: "var(--color-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${clampedWidth}%`,
            borderRadius: 999,
            background: reachedGoal ? "var(--color-success)" : "var(--color-primary)",
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
              background: "var(--color-text)",
              opacity: 0.5,
            }}
          />
        )}
      </div>
    </div>
  );
}
