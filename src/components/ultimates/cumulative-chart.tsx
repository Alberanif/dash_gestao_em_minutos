"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import type {
  CumulativePoint,
  UltimatesGranularity,
  UltimatesSeries,
} from "@/lib/ultimates/cumulative-chart";
import { fmtDateShort, fmtHourLong, fmtHourShort } from "@/lib/ultimates/format";

interface CumulativeChartProps {
  data: CumulativePoint[];
  series: UltimatesSeries;
  onSeriesChange: (series: UltimatesSeries) => void;
  // Política do ciclo (migration 053). Com ela false só existe uma métrica —
  // as vendas sem vínculo já vieram somadas em `data` por
  // applyNewPurchasesModeToCounts —, então o switch de séries não tem o que
  // alternar e é escondido em vez de mostrar uma curva zerada.
  countsNewBuyers: boolean;
  granularity: UltimatesGranularity;
  onGranularityChange: (granularity: UltimatesGranularity) => void;
  // Se a série horária chegou. Prop explícita, e não inferida de `data` vazio:
  // lista vazia também é "ciclo sem venda ainda", um estado legítimo que não
  // deve esconder o switch. Com ela false o grupo de granularidade some — o
  // chip "Hora" existir levando a um gráfico vazio é pior do que não existir.
  granularityAvailable: boolean;
}

const TICK = { fontSize: 10, fill: "var(--text-3)" };

// Uma linha do dataset que vai para o Recharts. `x` é o rótulo do eixo,
// `tooltip` o do balão — separados porque o eixo precisa ser curto e o balão
// pode ser lido por extenso.
export interface CumulativeChartRow {
  x: string;
  tooltip: string;
  cumulative: number;
}

// Traduz os pontos acumulados (chave temporal crua) para rótulos pt-BR.
//
// Função exportada e pura de propósito: sob o jsdom o ResponsiveContainer tem
// tamanho zero e o Recharts não desenha eixo nem tooltip, então esta escolha
// de formatador é o único trecho do gráfico que nenhum teste de componente
// consegue observar — inverter os dois pares deixaria todo tick lendo
// "01T20/07" com a suíte inteira verde. Testada direto em
// __tests__/cumulative-chart.test.tsx, e é ESTA função que o componente usa,
// para o teste cobrir o caminho real e não uma cópia.
//
// A chave crua nunca vira Date: ela já é hora de parede em Brasília.
export function buildChartRows(
  data: CumulativePoint[],
  granularity: UltimatesGranularity
): CumulativeChartRow[] {
  const porHora = granularity === "hora";
  return data.map((d) => ({
    x: porHora ? fmtHourShort(d.key) : fmtDateShort(d.key),
    tooltip: porHora ? fmtHourLong(d.key) : fmtDateShort(d.key),
    cumulative: d.cumulative,
  }));
}

// Tudo que muda entre as duas séries vive aqui — o desenho abaixo é um só.
// A cor de "novos" é a mesma do KPI "Novos Compradores" (--orange, ver
// kpi-row.tsx), para o vínculo entre card 1 e card 2 ser óbvio; renovações
// mantém o violeta que já estava em produção.
const SERIES_CONFIG: Record<
  UltimatesSeries,
  { button: string; title: string; color: string; chip: string; chipBorder: string; chipText: string; empty: string }
> = {
  renovacoes: {
    button: "Renovações",
    title: "Renovações acumuladas",
    color: "var(--violet)",
    chip: "rgba(124, 111, 240, 0.14)",
    chipBorder: "rgba(124, 111, 240, 0.55)",
    chipText: "#b3a9ff",
    empty: "Sem renovações registradas no ciclo ainda.",
  },
  novos: {
    button: "Novos compradores",
    title: "Novos compradores acumulados",
    color: "var(--orange)",
    chip: "rgba(232, 133, 63, 0.14)",
    chipBorder: "rgba(232, 133, 63, 0.55)",
    chipText: "#f0b183",
    empty: "Sem novos compradores registrados no ciclo ainda.",
  },
};

const SERIES_ORDER: UltimatesSeries[] = ["renovacoes", "novos"];
const GRANULARITY_ORDER: UltimatesGranularity[] = ["dia", "hora"];
const GRANULARITY_LABELS: Record<UltimatesGranularity, string> = { dia: "Dia", hora: "Hora" };

// Acento do grupo de granularidade. Deliberadamente neutro: violeta e laranja
// significam MÉTRICA neste card (o laranja amarra a curva ao KPI "Novos
// Compradores"), então pintar o controle de granularidade com eles quebraria
// esse vínculo visual.
const NEUTRAL_ACCENT = {
  chip: "var(--surface-2)",
  chipBorder: "var(--border-strong)",
  chipText: "var(--text)",
};

interface ChipAccent {
  chip: string;
  chipBorder: string;
  chipText: string;
}

// Um grupo de chips mutuamente exclusivos. Os dois switches do card (métrica e
// granularidade) são o mesmo controle com conteúdo e acento diferentes.
function ChipSwitch<T extends string>({
  testId,
  label,
  options,
  active,
  onChange,
  accentFor,
}: {
  testId: string;
  // Nome da DIMENSÃO controlada, não do valor. Visualmente os dois grupos se
  // distinguem por posição e acento; para quem navega por leitor de tela, sem
  // ele são só quatro botões aria-pressed em fila ("Renovações, Novos
  // compradores, Dia, Hora"), sem indicação de quais dois andam juntos.
  label: string;
  options: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
  accentFor: (value: T) => ChipAccent;
}) {
  return (
    <div
      data-testid={testId}
      role="group"
      aria-label={label}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
    >
      {options.map(({ value, label }) => {
        const isActive = value === active;
        const accent = accentFor(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(value)}
            data-testid={`${testId.replace("-switch", "")}-${value}`}
            style={{
              padding: "5px 11px",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
              borderRadius: 20,
              border: isActive ? `1px solid ${accent.chipBorder}` : "1px solid var(--border-vis)",
              background: isActive ? accent.chip : "var(--surface)",
              color: isActive ? accent.chipText : "var(--text-muted)",
              cursor: "pointer",
              transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Acima deste número de pontos a animação de entrada do Recharts é
// desligada. `dot={false}` já evita nós de DOM por ponto, mas a animação
// padrão interpola o path inteiro (todas as coordenadas) a cada render — algo
// barato para os ~30-180 pontos de um ciclo diário, mas caro para a curva
// horária, que pode chegar a 8760 pontos (1 ano, ver TETO_HORAS_PREENCHIDAS
// em cumulative-chart.ts). 300 fica folgado acima do maior ciclo diário
// plausível e bem abaixo do menor cenário horário problemático.
const LIMIAR_PONTOS_SEM_ANIMACAO = 300;

// Gráfico acumulado do card "Evolução" (PRD issue #114, seção 3.3, critério
// 9), alternável entre renovações e novos compradores, e entre as
// granularidades dia/hora. Os dados já vêm acumulados de
// buildCumulativeSeries/buildHourlyCumulativeSeries — aqui só formatamos
// eixos (pt-BR) e desenhamos. A altura vive em .ult-chart-body
// (ultimates.css) para o mobile reduzir via media query.
export function CumulativeChart({
  data,
  series,
  onSeriesChange,
  countsNewBuyers,
  granularity,
  onGranularityChange,
  granularityAvailable,
}: CumulativeChartProps) {
  const config = SERIES_CONFIG[series];
  const porHora = granularity === "hora";
  // Memo pelo mesmo motivo do `chartPoints` no dashboard: são até 8760 pontos,
  // cada um com dois formatos baseados em split. Todos os modais do dashboard
  // (upload, ofertas excluídas, vincular, desvincular) moram no pai deste
  // componente, então abrir qualquer um deles re-renderiza o card — sem o memo,
  // refazendo a tradução inteira para nada.
  const chartData = useMemo(() => buildChartRows(data, granularity), [data, granularity]);
  // O eixo temporal é compartilhado pelas duas séries (a RPC agrega as duas
  // juntas), então "sem dados" aqui não é lista vazia: é a série ativa somar
  // zero. Sem isso, um ciclo só com novos compradores mostraria a curva de
  // renovações como uma linha reta colada no eixo, parecendo bug.
  const isEmpty = data.length === 0 || data[data.length - 1].cumulative === 0;
  const gradientId = `ultimatesCumulativeGradient-${series}`;
  const title = porHora ? `${config.title} — por hora` : config.title;

  return (
    <div
      data-testid="ultimates-cumulative-chart"
      data-series={series}
      data-granularity={granularity}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderRadius: 11,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          margin: "0 0 14px",
        }}
      >
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-label)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            margin: 0,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: config.color, flexShrink: 0 }} />
          {title}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {countsNewBuyers && (
            <ChipSwitch
              testId="ultimates-cumulative-series-switch"
              label="Métrica"
              options={SERIES_ORDER.map((value) => ({ value, label: SERIES_CONFIG[value].button }))}
              active={series}
              onChange={onSeriesChange}
              accentFor={(value) => SERIES_CONFIG[value]}
            />
          )}
          {granularityAvailable && (
            <ChipSwitch
              testId="ultimates-cumulative-granularity-switch"
              label="Granularidade"
              options={GRANULARITY_ORDER.map((value) => ({ value, label: GRANULARITY_LABELS[value] }))}
              active={granularity}
              onChange={onGranularityChange}
              accentFor={() => NEUTRAL_ACCENT}
            />
          )}
        </div>
      </div>

      {isEmpty ? (
        <div
          data-testid="ultimates-cumulative-chart-empty"
          style={{
            padding: "32px 0",
            textAlign: "center",
            fontSize: 13,
            color: "var(--text-muted)",
          }}
        >
          {config.empty}
        </div>
      ) : (
        <div className="ult-chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={config.color} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              {/* minTickGap maior por hora: são centenas de pontos, e o
                  rótulo horário é mais largo que o de dia. */}
              <XAxis
                dataKey="x"
                tick={TICK}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={porHora ? 48 : 24}
              />
              <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--text)",
                }}
                labelStyle={{ color: "var(--text-muted)" }}
                itemStyle={{ color: "var(--text)" }}
                labelFormatter={(_label: unknown, payload?: readonly { payload?: { tooltip?: string } }[]) =>
                  payload?.[0]?.payload?.tooltip ?? ""
                }
                formatter={(value) => [value, config.title]}
              />
              <Area
                dataKey="cumulative"
                name={config.title}
                stroke={config.color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={chartData.length < LIMIAR_PONTOS_SEM_ANIMACAO}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
