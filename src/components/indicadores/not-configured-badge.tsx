"use client";

export function NotConfiguredBadge({ text }: { text: string }) {
  return (
    <div style={{
      padding: "6px 20px",
      fontSize: 11,
      color: "var(--text-3)",
      background: "var(--surface-2)",
      borderBottom: "1px solid var(--border-vis)",
    }}>
      {text}
    </div>
  );
}
