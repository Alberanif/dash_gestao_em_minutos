import type { FilterRecord } from "@/types/indicadores";
import { eventoOrganicBadgeLabel } from "@/lib/indicadores/eventos";

/** Selo discreto "Orgânico"; não renderiza nada para eventos pagos. Tokens: --badge-green-* (.dash-dark). */
export function EventoOrganicoBadge({ filter }: { filter: Pick<FilterRecord, "is_organic"> | null }) {
  const label = filter ? eventoOrganicBadgeLabel(filter) : null;
  if (!label) return null;
  return (
    <span
      data-testid="evento-organico-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        marginLeft: 8,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        background: "var(--badge-green-bg)",
        color: "var(--badge-green-fg)",
      }}
    >
      {label}
    </span>
  );
}
