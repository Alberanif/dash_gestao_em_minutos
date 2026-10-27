import { cx } from "./cx";

export type TomDoSelo = "neutro" | "info" | "ok" | "aviso" | "erro";

const tons: Record<TomDoSelo, string> = {
  neutro: "bg-v2-nevoa/10 text-v2-nevoa/75",
  info: "bg-v2-azul-igt/20 text-v2-azul-luz",
  ok: "bg-v2-alta/15 text-v2-alta",
  aviso: "bg-v2-ponto/15 text-v2-ponto",
  erro: "bg-v2-queda/15 text-v2-queda",
};

/** Selo de estado. O texto sempre diz o estado: a cor sozinha não carrega o significado. */
export function Selo({
  tom = "neutro",
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tom?: TomDoSelo }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold",
        tons[tom],
        className,
      )}
      {...rest}
    />
  );
}
