import type { RosterKpis } from "@/lib/ultimates/kpi-aggregation";
import { fmtPercent1 } from "@/lib/ultimates/format";

interface KpiRowProps {
  kpis: RosterKpis;
  // Política do ciclo (migration 053). A derivação já veio pronta em `kpis`;
  // esta prop só decide qual dos dois 5º tiles renderizar — os dados sozinhos
  // não distinguem "ciclo sem novas compras" de "ciclo que teve zero novas
  // compras".
  countsNewBuyers: boolean;
}

// Tile no estilo dos KPIs do Indicadores (hero-kpi-card): rótulo uppercase
// com ponto de acento, valor forte, subtítulo apagado.
function KpiTile({
  label,
  value,
  sub,
  dotColor,
  testId,
}: {
  label: string;
  value: string;
  sub?: string;
  dotColor: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderRadius: 11,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--text-label)",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        {label}
      </span>
      <span
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      {sub && <span style={{ fontSize: 12, color: "var(--text-3)" }}>{sub}</span>}
    </div>
  );
}

// Linha de KPIs do dashboard do ciclo (PRD issue #114, seção 3.2, critério
// 9). Todos os números vêm de aggregateRosterKpis sobre a MESMA chamada ao
// roster usada pela tabela — nunca uma fonte separada, para que os números
// batam entre si.
export function KpiRow({ kpis, countsNewBuyers }: KpiRowProps) {
  const semVinculoTotal = kpis.renovacoesSemVinculo + kpis.renovacoesSemVinculoReembolsadas;

  return (
    <div data-testid="ultimates-kpi-row" className="ult-kpi-grid">
      <KpiTile testId="ultimates-kpi-base" label="Base" value={String(kpis.base)} dotColor="var(--violet)" />
      <KpiTile
        testId="ultimates-kpi-renovados"
        label="Renovados"
        value={
          kpis.renovacoesSemVinculo > 0
            ? `${kpis.renovados} (+${kpis.renovacoesSemVinculo} sem vínculo)`
            : String(kpis.renovados)
        }
        sub={`${fmtPercent1(kpis.renovadosPercent)} da base`}
        dotColor="var(--green)"
      />
      <KpiTile
        testId="ultimates-kpi-renovacao-reembolsada"
        label="Renovação reembolsada"
        value={
          kpis.renovacoesSemVinculoReembolsadas > 0
            ? `${kpis.renovacaoReembolsada} (+${kpis.renovacoesSemVinculoReembolsadas} sem vínculo)`
            : String(kpis.renovacaoReembolsada)
        }
        dotColor="var(--amber)"
      />
      <KpiTile
        testId="ultimates-kpi-nao-renovados"
        label="Não renovados"
        value={String(kpis.naoRenovados)}
        // Dica, NUNCA abatimento: o valor precisa continuar batendo com o que o
        // filtro "Não renovado" devolve na tabela (critério 9 do PRD #114).
        sub={
          kpis.possivelmenteRenovados > 0
            ? `até ${kpis.possivelmenteRenovados} renovaram com outro email`
            : undefined
        }
        dotColor="var(--red)"
      />
      {countsNewBuyers ? (
        <KpiTile
          testId="ultimates-kpi-novos-compradores"
          label="Novos Compradores"
          value={
            kpis.novosReembolsados > 0
              ? `${kpis.novosCompradores} (+${kpis.novosReembolsados} ⟲)`
              : String(kpis.novosCompradores)
          }
          dotColor="var(--orange)"
        />
      ) : (
        // Mesma cor de acento do tile que substitui — o número é a fila de
        // trabalho do "Vincular à base".
        <KpiTile
          testId="ultimates-kpi-renovacoes-sem-vinculo"
          label="Renovações sem vínculo"
          value={
            kpis.renovacoesSemVinculoReembolsadas > 0
              ? `${semVinculoTotal} (+${kpis.renovacoesSemVinculoReembolsadas} ⟲)`
              : String(semVinculoTotal)
          }
          dotColor="var(--orange)"
        />
      )}
    </div>
  );
}
