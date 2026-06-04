type StatusColor = "green" | "amber" | "red";
type ChipStatus = "green" | "amber" | "red" | "muted";

export interface PlatformPct {
  ytPct: number;
  igPct: number;
}

interface Chip {
  label: string;
  status: ChipStatus;
}

interface PulseBannerResult {
  status: StatusColor;
  headline: string;
  chips: Chip[];
}

export function calcPlatformStatus(pct: number): StatusColor {
  if (pct >= 5) return "green";
  if (pct < -5) return "red";
  return "amber";
}

export function calcPulseBanner({ ytPct, igPct }: PlatformPct): PulseBannerResult {
  const ytStatus = calcPlatformStatus(ytPct);
  const igStatus = calcPlatformStatus(igPct);

  const chips: Chip[] = [
    { label: "YouTube", status: ytStatus },
    { label: "Instagram", status: igStatus },
  ];

  const hasRed = ytStatus === "red" || igStatus === "red";
  const bothGreen = ytStatus === "green" && igStatus === "green";

  let status: StatusColor;
  let headline: string;

  if (bothGreen) {
    status = "green";
    headline = "Audiência crescendo em ambas as plataformas";
  } else if (hasRed) {
    status = "red";
    headline = "Atenção: perda de audiência detectada";
  } else {
    status = "amber";
    headline = "Crescimento misto entre plataformas";
  }

  return { status, headline, chips };
}

export function calcVerdict(
  status: StatusColor,
  prevValue: number,
  currValue: number
): string {
  const diff = currValue - prevValue;
  const diffFormatted = Math.abs(diff).toLocaleString("pt-BR");

  if (status === "green") {
    return `<b>Crescimento</b> de ${diffFormatted} no período`;
  }
  if (status === "red") {
    return `<b>Queda</b> de ${diffFormatted} no período`;
  }
  if (diff > 0) {
    return `Ganho leve de ${diffFormatted} no período`;
  }
  if (diff < 0) {
    return `Redução leve de ${diffFormatted} no período`;
  }
  return "Sem variação no período";
}
