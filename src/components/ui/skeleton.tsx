export function SkeletonCard() {
  return (
    <div className="bg-white rounded-[10px] p-5 animate-pulse" style={{ boxShadow: "var(--shadow-card)", border: "1px solid var(--color-border)" }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-gray-200" />
        <div className="w-20 h-12 rounded bg-gray-100" />
      </div>
      <div className="h-9 w-28 rounded bg-gray-200 mb-2" />
      <div className="h-4 w-20 rounded bg-gray-100 mb-3" />
      <div className="h-4 w-24 rounded bg-gray-100" />
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="bg-white rounded-[10px] animate-pulse overflow-hidden" style={{ boxShadow: "var(--shadow-card)", border: "1px solid var(--color-border)" }}>
      {/* Header */}
      <div className="h-10 bg-slate-50 border-b flex items-center px-4 gap-4" style={{ borderColor: "var(--color-border)" }}>
        {[120, 80, 70, 70, 90].map((w, i) => (
          <div key={i} className="h-3 rounded bg-gray-200" style={{ width: w }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 border-b flex items-center px-4 gap-4" style={{ borderColor: "var(--color-border)", background: i % 2 === 0 ? "white" : "#F8FAFC" }}>
          {[120, 80, 70, 70, 90].map((w, j) => (
            <div key={j} className="h-3 rounded bg-gray-100" style={{ width: w }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-white rounded-[10px] p-5 animate-pulse" style={{ boxShadow: "var(--shadow-card)", border: "1px solid var(--color-border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-40 rounded bg-gray-200" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-12 rounded bg-gray-100" />
          ))}
        </div>
      </div>
      <div className="h-4 w-48 rounded bg-gray-100 mb-6" />
      <div className="h-64 w-full rounded bg-gray-100" />
    </div>
  );
}
