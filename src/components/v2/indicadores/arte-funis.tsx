import { useId } from "react";

/**
 * Miniatura da tela de Eventos, desenhada em SVG: chips de KPI em cima, o funil no centro e linhas
 * de lista embaixo. Sem texto legível de propósito, para ler como "tela de funis" sem prometer
 * números. Só azul: o âmbar é reservado ao dado vivo.
 */
const FAIXAS = [
  { y: 52, topo: 168, base: 148, cor: "var(--v2-funil-1)" },
  { y: 66, topo: 144, base: 122, cor: "var(--v2-funil-2)" },
  { y: 80, topo: 118, base: 96, cor: "var(--v2-funil-3)" },
  { y: 94, topo: 92, base: 72, cor: "var(--v2-funil-4)" },
  { y: 108, topo: 68, base: 52, cor: "var(--v2-funil-5)" },
] as const;

const ALTURA_FAIXA = 12;

function trapezio({ y, topo, base }: (typeof FAIXAS)[number]): string {
  const cx = 128;
  return [
    `${cx - topo / 2},${y}`,
    `${cx + topo / 2},${y}`,
    `${cx + base / 2},${y + ALTURA_FAIXA}`,
    `${cx - base / 2},${y + ALTURA_FAIXA}`,
  ].join(" ");
}

export function ArteFunis() {
  // ids únicos: o overlay de entrada renderiza uma segunda cópia da arte ao mesmo tempo.
  const uid = useId().replace(/:/g, "");
  const feixe = `feixe-${uid}`;
  const janela = `janela-${uid}`;
  return (
    <div className="v2-arte">
      <svg viewBox="0 0 256 190" role="img" aria-label="Prévia da tela de funis: indicadores, funil e lista de eventos" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={feixe} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--v2-azul-luz)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--v2-azul-luz)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--v2-azul-luz)" stopOpacity="0" />
          </linearGradient>
          <clipPath id={janela}>
            <rect x="16" y="14" width="224" height="162" rx="10" />
          </clipPath>
        </defs>

        <rect x="16" y="14" width="224" height="162" rx="10" fill="var(--v2-abismo)" stroke="var(--v2-azul-luz)" strokeOpacity="0.15" />

        <g clipPath={`url(#${janela})`}>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={26 + i * 54} y="24" width="48" height="18" rx="4" fill="var(--v2-casco-alto)" />
              <rect x={31 + i * 54} y="29" width="22" height="3" rx="1.5" fill="var(--v2-azul-luz)" fillOpacity="0.55" />
              <rect x={31 + i * 54} y="35" width="14" height="2.5" rx="1.25" fill="var(--v2-nevoa)" fillOpacity="0.3" />
            </g>
          ))}

          {FAIXAS.map((f, i) => (
            <polygon key={f.y} className="v2-arte-faixa" style={{ "--i": i } as React.CSSProperties} points={trapezio(f)} fill={f.cor} />
          ))}

          {[0, 1].map((i) => (
            <g key={i}>
              <circle cx="30" cy={136 + i * 16} r="3" fill="var(--v2-azul-igt)" />
              <rect x="40" y={133.5 + i * 16} width={i === 0 ? 96 : 72} height="5" rx="2.5" fill="var(--v2-nevoa)" fillOpacity="0.22" />
              <rect x="190" y={133.5 + i * 16} width="36" height="5" rx="2.5" fill="var(--v2-azul-luz)" fillOpacity="0.4" />
            </g>
          ))}

          <rect className="v2-arte-feixe" x="108" y="-90" width="40" height="90" fill={`url(#${feixe})`} />
        </g>
      </svg>
    </div>
  );
}
