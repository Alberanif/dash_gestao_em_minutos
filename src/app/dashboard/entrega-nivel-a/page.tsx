"use client";

import { GvPageHeader } from "@/components/gv/gv-page-header";
import { PulseBanner } from "@/components/gv/pulse-banner";
import { NarrLabel } from "@/components/gv/narr-label";
import { DeliveryCard } from "@/components/gv/delivery-card";
import { StatCard } from "@/components/gv/stat-card";

const ICON_MENTORIA = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ICON_PRESENCA = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const ICON_NPS = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ICON_CASOS = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const MCC_FCC_PROJETOS = [
  { name: "MCC", period: "Jun 2026", expected: 8, delivered: 8, score: 94, status: "green" as const },
  { name: "FCC", period: "Jun 2026", expected: 12, delivered: 9, score: 76, status: "amber" as const },
];

const MENSAL_STATS = [
  {
    icon: ICON_MENTORIA,
    title: "Mentorias Entregues",
    value: "142",
    status: "green" as const,
    foot: "acumulado no mês",
    sparkData: [120, 128, 130, 135, 138, 140, 142],
  },
  {
    icon: ICON_PRESENCA,
    title: "Presença Média",
    value: "87",
    unit: "%",
    status: "green" as const,
    foot: "média das sessões",
    sparkData: [82, 85, 84, 88, 86, 87, 87],
  },
  {
    icon: ICON_NPS,
    title: "NPS Médio",
    value: "68",
    status: "amber" as const,
    foot: "média dos projetos",
    sparkData: [72, 70, 68, 65, 67, 69, 68],
  },
  {
    icon: ICON_CASOS,
    title: "Casos de Sucesso",
    value: "23",
    status: "green" as const,
    foot: "publicados no mês",
    sparkData: [14, 16, 18, 19, 21, 22, 23],
  },
];

const ULTIMATE_PROJETOS = [
  { name: "Ultimate SP", period: "Jun 2026", expected: 10, delivered: 10, score: 95, status: "green" as const },
  { name: "Ultimate RJ", period: "Jun 2026", expected: 10, delivered: 7, score: 71, status: "amber" as const },
  { name: "Ultimate BH", period: "Jun 2026", expected: 10, delivered: 4, score: 45, status: "red" as const },
];

const DESTRAVE_PROJETOS = [
  { name: "Destrave A", period: "Jun 2026", expected: 6, delivered: 6, score: 90, status: "green" as const },
  { name: "Destrave B", period: "Jun 2026", expected: 6, delivered: 4, score: 70, status: "amber" as const },
  { name: "Destrave C", period: "Jun 2026", expected: 6, delivered: 2, score: 38, status: "red" as const },
];

function derivePulseStatus(
  projetos: { status: "green" | "amber" | "red" }[]
): "green" | "amber" | "red" {
  if (projetos.some((p) => p.status === "red")) return "red";
  if (projetos.some((p) => p.status === "amber")) return "amber";
  return "green";
}

const allProjetos = [...MCC_FCC_PROJETOS, ...ULTIMATE_PROJETOS, ...DESTRAVE_PROJETOS];
const pulseStatus = derivePulseStatus(allProjetos);
const greenCount = allProjetos.filter((p) => p.status === "green").length;
const amberCount = allProjetos.filter((p) => p.status === "amber").length;
const redCount = allProjetos.filter((p) => p.status === "red").length;

const pulseHeadlineMap: Record<"green" | "amber" | "red", string> = {
  green: "Todos os projetos em dia",
  amber: `${amberCount} projeto${amberCount !== 1 ? "s" : ""} necessita${amberCount !== 1 ? "m" : ""} atenção`,
  red: `${redCount} projeto${redCount !== 1 ? "s" : ""} abaixo da meta`,
};

const pulseSubMap: Record<"green" | "amber" | "red", string> = {
  green: `${greenCount} projetos cumprindo as metas de entrega`,
  amber: `${greenCount} em dia · ${amberCount} em atenção · ${redCount} crítico${redCount !== 1 ? "s" : ""}`,
  red: `${greenCount} em dia · ${amberCount} em atenção · ${redCount} crítico${redCount !== 1 ? "s" : ""}`,
};

export default function EntregaNivelAPage() {
  return (
    <div className="main">
      <GvPageHeader
        title="Entrega Nível A"
        sub="O quanto cada projeto está cumprindo o que prometeu entregar"
      />

      <div className="section">
        <PulseBanner
          status={pulseStatus}
          headline={pulseHeadlineMap[pulseStatus]}
          sub={pulseSubMap[pulseStatus]}
          chips={[
            { label: `${greenCount} Em Dia`, status: "green" },
            ...(amberCount > 0 ? [{ label: `${amberCount} Atenção`, status: "amber" as const }] : []),
            ...(redCount > 0 ? [{ label: `${redCount} Crítico${redCount !== 1 ? "s" : ""}`, status: "red" as const }] : []),
          ]}
        />

        <div>
          <NarrLabel step="01" label="MCC + FCC — Projeto" />
          <div className="grid g2">
            {MCC_FCC_PROJETOS.map((p) => (
              <DeliveryCard key={p.name} {...p} />
            ))}
          </div>
        </div>

        <div>
          <NarrLabel step="02" label="Mensal Consolidado" />
          <div className="grid g4">
            {MENSAL_STATS.map((s) => (
              <StatCard key={s.title} {...s} />
            ))}
          </div>
        </div>

        <div>
          <NarrLabel step="03" label="Ultimate — Projeto" />
          <div className="grid g3">
            {ULTIMATE_PROJETOS.map((p) => (
              <DeliveryCard key={p.name} {...p} />
            ))}
          </div>
        </div>

        <div>
          <NarrLabel step="04" label="Destrave — Projeto" />
          <div className="grid g3">
            {DESTRAVE_PROJETOS.map((p) => (
              <DeliveryCard key={p.name} {...p} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
