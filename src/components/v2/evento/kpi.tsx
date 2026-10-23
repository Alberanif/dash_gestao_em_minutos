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
      className="group relative min-w-0 overflow-hidden"
      style={
        {
          backgroundImage: `radial-gradient(110% 90% at 100% 0%, color-mix(in srgb, ${cor} 9%, transparent), transparent 62%)`,
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
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: `linear-gradient(90deg, ${cor}, transparent 80%)` }}
      />
      <div className="flex items-center gap-2.5">
        <SeloIcone nome={icone} dado={dado} tamanho="sm" />
        <p className="text-sm text-v2-nevoa/70">{rotulo}</p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className={grande ? "truncate text-4xl font-light tabular-nums tracking-tight" : "truncate text-3xl font-light tabular-nums tracking-tight @xl:text-4xl"}>
          {children}
        </p>
        {lateral}
      </div>
      {nota ? <p className="mt-1 text-xs text-v2-nevoa/50">{nota}</p> : null}
    </Surface>
  );
}
