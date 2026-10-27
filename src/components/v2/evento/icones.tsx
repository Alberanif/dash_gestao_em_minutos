import { corDado, type Dado } from "../cor";

const TRACO = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Ícones de traço fino, desenhados à mão em 24×24. Um por tipo de número que o dashboard mostra. */
const DESENHOS = {
  impressoes: (
    <g>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" {...TRACO} />
      <circle cx="12" cy="12" r="3" {...TRACO} />
    </g>
  ),
  cliques: <path d="M6 3.5 18 12l-5.2 1.3L10.6 19 6 3.5Z" {...TRACO} />,
  pagina: (
    <g>
      <rect x="4" y="4" width="16" height="16" rx="2.5" {...TRACO} />
      <path d="M4 9h16M8 13h5M8 16.5h8" {...TRACO} />
    </g>
  ),
  leads: (
    <g>
      <circle cx="12" cy="8" r="3.5" {...TRACO} />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" {...TRACO} />
    </g>
  ),
  vendas: (
    <g>
      <path d="M5.5 8h13l-1 11.5h-11L5.5 8Z" {...TRACO} />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8M9.5 13.5l2 2 3.5-3.8" {...TRACO} />
    </g>
  ),
  roas: (
    <g>
      <path d="M3.5 17 9.5 11l4 4 7-7.5" {...TRACO} />
      <path d="M15 7.5h5.5V13" {...TRACO} />
    </g>
  ),
  receita: (
    <g>
      <circle cx="12" cy="12" r="8.5" {...TRACO} />
      <path d="M14.8 9.2c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.7.8-2.7 2 0 2.8 5.6 1.3 5.6 4.2 0 1.2-1.2 2.1-2.9 2.1-1.4 0-2.5-.6-3-1.6M12 6.2v1.6M12 16.2v1.6" {...TRACO} />
    </g>
  ),
} as const;

export type NomeIcone = keyof typeof DESENHOS;

/** Selo redondo com o ícone, tingido na cor do dado: o ícone e o anel são da cor, o fundo é só um sopro dela. */
export function SeloIcone({ nome, dado, tamanho = "md" }: { nome: NomeIcone; dado: Dado; tamanho?: "md" | "sm" }) {
  const cor = corDado(dado);
  return (
    <span
      className={tamanho === "md" ? "grid size-10 shrink-0 place-items-center rounded-full" : "grid size-8 shrink-0 place-items-center rounded-full"}
      style={{
        color: cor,
        background: `color-mix(in srgb, ${cor} 14%, var(--v2-casco-alto))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} 38%, transparent)`,
      }}
    >
      <svg viewBox="0 0 24 24" className={tamanho === "md" ? "size-5" : "size-4"} aria-hidden="true">
        {DESENHOS[nome]}
      </svg>
    </span>
  );
}
