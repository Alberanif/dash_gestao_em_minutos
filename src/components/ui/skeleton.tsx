export function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-[var(--radius-card)] p-5"
      style={{
        background: "var(--color-surface)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div style={{ width: 36, height: 36, borderRadius: 999, background: "#E2E8F0" }} />
        <div className="h-6 w-16 rounded-full" style={{ background: "#E2E8F0" }} />
      </div>
      <div className="mb-3 h-8 w-28 rounded" style={{ background: "#E2E8F0" }} />
      <div className="h-12 w-full rounded" style={{ background: "#E2E8F0" }} />
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div
      className="animate-pulse overflow-hidden rounded-[var(--radius-card)]"
      style={{
        background: "var(--color-surface)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex h-10 items-center gap-4 border-b px-4" style={{ background: "#F8FAFC", borderColor: "var(--color-border)" }}>
        {[120, 80, 70, 70, 90].map((w, i) => (
          <div key={i} className="h-3 rounded" style={{ width: w, background: "#E2E8F0" }} />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex h-12 items-center gap-4 border-b px-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          {[120, 80, 70, 70, 90].map((w, j) => (
            <div key={j} className="h-3 rounded" style={{ width: w, background: "#E2E8F0" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div
      className="animate-pulse rounded-[var(--radius-card)] p-5"
      style={{
        background: "var(--color-surface)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-40 rounded" style={{ background: "#E2E8F0" }} />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-12 rounded-full" style={{ background: "#E2E8F0" }} />
          ))}
        </div>
      </div>
      <div className="mb-6 h-4 w-48 rounded" style={{ background: "#E2E8F0" }} />
      <div className="h-64 w-full rounded" style={{ background: "#E2E8F0" }} />
    </div>
  );
}
