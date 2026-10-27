import { corDado, type Dado } from "../cor";
import { Surface } from "../ui/surface";
import { SeloIcone, type NomeIcone } from "./icones";

/**
 * Card de KPI: selo de ícone e barra de acento na cor do dado, um sopro dessa cor no canto e um brilho
 * ao passar o mouse. O número fica em branco; `children` recebe o valor (normalmente um CountUp).
 */
export function Kpi({
  rotulo,
  nota,
  dado,
  icone,
  grande = false,
  children,
  lateral,
}: {
  rotulo: string;
  nota?: string;
  dado: Dado;
  icone: NomeIcone;
  /** Número maior, para o KPI principal do bloco. */
  grande?: boolean;
  children: React.ReactNode;
  /** Algo à direita do número, como uma tendência. */
  lateral?: React.ReactNode;
}) {
  const cor = corDado(dado);
  return (
    <Surface
      className="group @container relative min-w-0 overflow-hidden"
      style={
        {
          backgroundImage: `radial-gradient(110% 90% at 100% 0%, color-mix(in srgb, ${cor} 24%, transparent), transparent 70%), linear-gradient(180deg, color-mix(in srgb, ${cor} 9%, var(--v2-casco)), var(--v2-casco))`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} 34%, transparent), inset 0 1px 0 color-mix(in srgb, ${cor} 55%, transparent), var(--v2-sombra-1)`,
        } as React.CSSProperties
      }
    >
      {/* O brilho do hover é uma camada que só muda de opacidade. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-v2-md opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ boxShadow: `inset 0 0 42px color-mix(in srgb, ${cor} 18%, transparent)` }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${cor}, transparent 90%)` }}
      />
      <div className="flex min-w-0 items-center gap-2.5">
        <SeloIcone nome={icone} dado={dado} tamanho="sm" />
        <p className="min-w-0 truncate text-sm text-v2-nevoa/70" title={rotulo}>
          {rotulo}
        </p>
      </div>
      <div className="mt-3 flex min-w-0 items-end justify-between gap-3">
        {/* nowrap por causa do NBSP do Intl; a fonte encolhe com a largura do cartão em vez de vazar. */}
        <p
          className="min-w-0 flex-1 truncate whitespace-nowrap font-light tabular-nums tracking-tight"
          style={{ fontSize: grande ? "clamp(1.5rem, 12cqi, 2.25rem)" : "clamp(1.25rem, 10cqi, 2.25rem)", lineHeight: 1.15 }}
        >
          {children}
        </p>
        {lateral}
      </div>
      {nota ? <p className="mt-1 truncate text-xs text-v2-nevoa/50" title={nota}>{nota}</p> : null}
    </Surface>
  );
}
