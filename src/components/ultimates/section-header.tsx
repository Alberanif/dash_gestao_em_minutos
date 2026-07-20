// Cabeçalho de seção numerada — mesma linguagem visual do SectionHeader do
// Indicadores (src/app/indicadores/page.tsx): índice apagado, título forte e
// descrição curta na mesma linha de base.
export function SectionHeader({ index, title, desc }: { index: string; title: string; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 11, marginBottom: 15, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-4)" }}>{index}</span>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", margin: 0, letterSpacing: "-0.01em" }}>
        {title}
      </h3>
      <span style={{ fontSize: 12, color: "var(--text-3)" }}>{desc}</span>
    </div>
  );
}
