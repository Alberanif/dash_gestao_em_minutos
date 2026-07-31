import type { RosterKpis } from "@/lib/ultimates/kpi-aggregation";
import { fmtPercent1 } from "@/lib/ultimates/format";

interface KpiRowProps {
  kpis: RosterKpis;
  // Política do ciclo (migration 053). A derivação já veio pronta em `kpis`;
  // esta prop só decide qual dos dois 5º tiles renderizar — os dados sozinhos
  // não distinguem "ciclo sem novas compras" de "ciclo que teve zero novas
  // compras".
  countsNewBuyers: boolean;
  // Quantos leads da base estão excluídos da contabilidade (migration 055).
  // Anunciado no tile "Base" porque é ali que o número foi alterado: a exclusão
  // derruba o denominador do % da meta, e o contador no botão do cabeçalho
  // sozinho deixaria este tile mentindo por omissão para quem só bate o olho
  // nos KPIs.
  excludedBuyersCount?: number;
  // KPIs da janela recortada pelo filtro De/Até (spec 2026-07-31). Quando
  // presente, os tiles de MOVIMENTO (Renovados, Renovação reembolsada, Novos
  // Compradores / Renovações sem vínculo) saem daqui e os de ESTOQUE (Base,
  // Não renovados) continuam saindo de `kpis`.
  //
  // A separação não é estética: `nao_renovado` é AUSÊNCIA de venda e não tem
  // data, então "não renovados no período" não é pergunta bem formada — e
  // recortar a base junto colaria o % da meta em ~100% em qualquer intervalo,
  // porque o denominador acompanharia o numerador. `undefined` = sem filtro.
  periodKpis?: RosterKpis;
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
export function KpiRow({
  kpis,
  countsNewBuyers,
  excludedBuyersCount = 0,
  periodKpis,
}: KpiRowProps) {
  // Uma variável por NATUREZA do número, para que cada tile abaixo declare de
  // qual das duas ele lê: `mov` para movimento, `kpis` para estoque. Sem
  // filtro as duas são a mesma coisa.
  const mov = periodKpis ?? kpis;
  const filtrado = periodKpis !== undefined;
  const semVinculoTotal = mov.renovacoesSemVinculo + mov.renovacoesSemVinculoReembolsadas;

  return (
    <div data-testid="ultimates-kpi-row" className="ult-kpi-grid">
      {/* ESTOQUE: lê `kpis`, nunca `mov`. A base é o denominador do ciclo e
          não segue o filtro — ver o comentário de `periodKpis`. */}
      <KpiTile
        testId="ultimates-kpi-base"
        label="Base"
        value={String(kpis.base)}
        sub={
          excludedBuyersCount > 0
            ? `${excludedBuyersCount} ${excludedBuyersCount === 1 ? "excluído" : "excluídos"}`
            : undefined
        }
        dotColor="var(--violet)"
      />
      {/* Total puro, sem decompor as renovações sem vínculo: o número JÁ as
          inclui (aggregateRosterKpis soma renovado + renovacao_sem_vinculo), e
          o tile "Renovações sem vínculo" à direita é quem dá essa contagem
          quando ela existe. Por isso este tile é idêntico nos dois modos. */}
      <KpiTile
        testId="ultimates-kpi-renovados"
        label="Renovados"
        value={String(mov.renovados)}
        // Sob filtro o percentual SAI em vez de ser recalculado: com o valor
        // vindo da janela e a base do ciclo, "N% da base" misturaria numerador
        // e denominador de recortes diferentes na mesma frase. O percentual do
        // ciclo continua existindo, na barra de meta logo abaixo.
        sub={filtrado ? "no período" : `${fmtPercent1(kpis.renovadosPercent)} da base`}
        dotColor="var(--green)"
      />
      <KpiTile
        testId="ultimates-kpi-renovacao-reembolsada"
        label="Renovação reembolsada"
        value={
          mov.renovacoesSemVinculoReembolsadas > 0
            ? `${mov.renovacaoReembolsada} (+${mov.renovacoesSemVinculoReembolsadas} sem vínculo)`
            : String(mov.renovacaoReembolsada)
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
            mov.novosReembolsados > 0
              ? `${mov.novosCompradores} (+${mov.novosReembolsados} ⟲)`
              : String(mov.novosCompradores)
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
            mov.renovacoesSemVinculoReembolsadas > 0
              ? `${semVinculoTotal} (+${mov.renovacoesSemVinculoReembolsadas} ⟲)`
              : String(semVinculoTotal)
          }
          dotColor="var(--orange)"
        />
      )}
    </div>
  );
}
