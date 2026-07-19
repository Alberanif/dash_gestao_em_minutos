import type { RosterKpis } from "@/lib/ultimates/kpi-aggregation";
import { fmtPercent1 } from "@/lib/ultimates/format";

interface KpiRowProps {
  kpis: RosterKpis;
}

function KpiTile({
  label,
  value,
  sub,
  testId,
}: {
  label: string;
  value: string;
  sub?: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="surface-card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.1 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{sub}</span>
      )}
    </div>
  );
}

// Linha de KPIs do dashboard do ciclo (PRD issue #114, seção 3.2, critério
// 9). Todos os números vêm de aggregateRosterKpis sobre a MESMA chamada ao
// roster usada pela tabela — nunca uma fonte separada, para que os números
// batam entre si.
export function KpiRow({ kpis }: KpiRowProps) {
  return (
    <div
      data-testid="ultimates-kpi-row"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
      }}
    >
      <KpiTile testId="ultimates-kpi-base" label="Base" value={String(kpis.base)} />
      <KpiTile
        testId="ultimates-kpi-renovados"
        label="Renovados"
        value={String(kpis.renovados)}
        sub={`${fmtPercent1(kpis.renovadosPercent)} da base`}
      />
      <KpiTile
        testId="ultimates-kpi-renovacao-reembolsada"
        label="Renovação reembolsada"
        value={String(kpis.renovacaoReembolsada)}
      />
      <KpiTile
        testId="ultimates-kpi-nao-renovados"
        label="Não renovados"
        value={String(kpis.naoRenovados)}
      />
      <KpiTile
        testId="ultimates-kpi-novos-compradores"
        label="Novos Compradores"
        value={
          kpis.novosReembolsados > 0
            ? `${kpis.novosCompradores} (+${kpis.novosReembolsados} ⟲)`
            : String(kpis.novosCompradores)
        }
      />
    </div>
  );
}
