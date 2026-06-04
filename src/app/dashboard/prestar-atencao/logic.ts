export type Status = "green" | "amber" | "red";
export type Platform = "yt" | "ig";

export interface MetricRow {
  label: string;
  help: string;
  value: string;
  status: Status;
}

export interface PlatformHealth {
  platform: Platform;
  score: number;
  status: Status;
  rows: MetricRow[];
}

export interface PulseBannerData {
  status: Status;
  headline: string;
  sub: string;
  chips: { label: string; status: "green" | "amber" | "red" | "muted" }[];
}

export interface TileData {
  severity: "critical" | "attention" | "ok";
  label: string;
  value: string;
  description: string;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  yt: "YouTube",
  ig: "Instagram",
};

export function calcPlatformScore(rows: MetricRow[]): number {
  if (rows.length === 0) return 0;
  const green = rows.filter((r) => r.status === "green").length;
  return Math.round((green / rows.length) * 100);
}

export function derivePulseBanner(platforms: PlatformHealth[]): PulseBannerData {
  const allRows = platforms.flatMap((p) => p.rows);
  const redCount = allRows.filter((r) => r.status === "red").length;
  const amberCount = allRows.filter((r) => r.status === "amber").length;
  const greenCount = allRows.filter((r) => r.status === "green").length;

  let status: Status;
  let headline: string;
  let sub: string;

  if (redCount > 0 && amberCount > 0) {
    status = "red";
    headline = `${redCount} sinal crítico e ${amberCount} merecem atenção`;
    sub = "Foque primeiro nos itens críticos antes de avançar.";
  } else if (redCount > 0) {
    status = "red";
    headline = `${redCount} sinal${redCount > 1 ? " críticos" : " crítico"} detectado${redCount > 1 ? "s" : ""}`;
    sub = "Há métricas fora do esperado que precisam de ação imediata.";
  } else if (amberCount > 0 && greenCount === 0) {
    status = "amber";
    headline = "Dados insuficientes para avaliar";
    sub = `${amberCount} métrica${amberCount > 1 ? "s sem" : " sem"} dados reais configurados.`;
  } else if (amberCount > 0) {
    status = "amber";
    headline = `${amberCount} sinal${amberCount > 1 ? " merecem" : " merece"} atenção`;
    sub = "A maioria das métricas está saudável. Acompanhe os alertas.";
  } else {
    status = "green";
    headline = "Todos os sinais dentro do esperado";
    sub = "Nenhuma métrica crítica ou em alerta no momento.";
  }

  const chips = platforms.map((p) => ({
    label: PLATFORM_LABEL[p.platform],
    status: p.status as "green" | "amber" | "red" | "muted",
  }));

  return { status, headline, sub, chips };
}

export function deriveTiles(platforms: PlatformHealth[]): TileData[] {
  const signals: { severity: "critical" | "attention" | "ok"; label: string; value: string; description: string }[] =
    [];

  for (const p of platforms) {
    const name = PLATFORM_LABEL[p.platform];
    const redRows = p.rows.filter((r) => r.status === "red");
    const amberRows = p.rows.filter((r) => r.status === "amber");

    for (const row of redRows) {
      signals.push({
        severity: "critical",
        label: `${name} — ${row.label}`,
        value: row.value === "--" ? "Sem dados" : row.value,
        description: `${row.help} abaixo do esperado.`,
      });
    }

    for (const row of amberRows) {
      signals.push({
        severity: "attention",
        label: `${name} — ${row.label}`,
        value: row.value === "--" ? "Sem dados" : row.value,
        description: `${row.help} aguardando dados reais.`,
      });
    }
  }

  const sorted = signals.sort((a, b) => {
    const order = { critical: 0, attention: 1, ok: 2 };
    return order[a.severity] - order[b.severity];
  });

  const top3 = sorted.slice(0, 3);

  while (top3.length < 3) {
    top3.push({
      severity: "ok",
      label: "Demais métricas",
      value: "Estável",
      description: "Nenhum sinal fora do esperado neste grupo.",
    });
  }

  return top3;
}
