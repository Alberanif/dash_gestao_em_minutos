import { forwardRef } from "react";
import { cx, foco } from "./cx";

type Variante = "primario" | "secundario" | "fantasma";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
};

const base =
  "relative isolate inline-flex h-10 select-none items-center justify-center gap-2 overflow-hidden rounded-v2-sm px-4 text-sm font-medium " +
  "transition-transform duration-[120ms] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 " +
  // Hover é uma camada que só muda opacity: nenhuma cor é animada.
  "before:absolute before:inset-0 before:-z-10 before:bg-v2-nevoa/10 before:opacity-0 before:transition-opacity before:duration-[120ms] hover:before:opacity-100";

const variantes: Record<Variante, string> = {
  primario: "bg-v2-azul-igt text-v2-abismo shadow-v2-1",
  secundario: "bg-v2-casco-alto text-v2-nevoa shadow-v2-1",
  fantasma: "bg-transparent text-v2-azul-luz",
};

/** O âmbar (ponto) nunca é cor de botão. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variante = "primario", className, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx(base, variantes[variante], foco, className)} {...rest} />
  );
});
