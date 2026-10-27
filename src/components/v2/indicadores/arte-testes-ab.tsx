import { useId } from "react";

/**
 * Miniatura da tela de Testes A/B, desenhada em SVG: duas colunas lado a lado (A e B), a vencedora
 * um pouco mais alta e com o azul cheio, e embaixo duas curvas que se separam. Sem texto legível de
 * propósito, como a arte dos Funis. Só azul: o âmbar é reservado ao dado vivo.
 */
const COLUNAS = [
  { x: 56, altura: 62, cor: "var(--v2-funil-4)", chip: "var(--v2-nevoa)", chipOpacidade: 0.3 },
  { x: 136, altura: 82, cor: "var(--v2-azul-igt)", chip: "var(--v2-azul-luz)", chipOpacidade: 0.75 },
] as const;

const LARGURA = 64;
const BASE = 118;

export function ArteTestesAb() {
  // ids únicos: o overlay de entrada renderiza uma segunda cópia da arte ao mesmo tempo.
  const uid = useId().replace(/:/g, "");
  const feixe = `feixe-${uid}`;
  const janela = `janela-${uid}`;
  return (
    <div className="v2-arte">
      <svg viewBox="0 0 256 190" role="img" aria-label="Prévia da tela de testes A/B: duas versões comparadas e a curva de conversão de cada uma" preserveAspectRatio="xMidYMid slice">
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
          {COLUNAS.map((c, i) => (
            <g key={c.x}>
              <rect
                className="v2-arte-faixa"
                style={{ "--i": i * 2 } as React.CSSProperties}
                x={c.x}
                y={BASE - c.altura}
                width={LARGURA}
                height={c.altura}
                rx="6"
                fill={c.cor}
              />
              <rect x={c.x + 12} y={BASE - c.altura + 10} width="26" height="4" rx="2" fill={c.chip} fillOpacity={c.chipOpacidade} />
              <rect x={c.x + 12} y={BASE - c.altura + 18} width="40" height="3" rx="1.5" fill="var(--v2-nevoa)" fillOpacity="0.22" />
            </g>
          ))}

          <line x1="30" y1={BASE + 6} x2="226" y2={BASE + 6} stroke="var(--v2-nevoa)" strokeOpacity="0.12" />

          <polyline points="32,162 72,158 112,160 152,154 192,152 224,150" fill="none" stroke="var(--v2-funil-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="32,162 72,157 112,153 152,144 192,138 224,132" fill="none" stroke="var(--v2-azul-luz)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          <rect className="v2-arte-feixe" x="108" y="-90" width="40" height="90" fill={`url(#${feixe})`} />
        </g>
      </svg>
    </div>
  );
}
