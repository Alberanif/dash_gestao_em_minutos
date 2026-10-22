import { cx } from "./cx";

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Nível de profundidade: 1 repouso, 2 elevado. */
  nivel?: 1 | 2;
};

/** Card de superfície: azul em camadas, borda de luz interna e sombra azulada. */
export function Surface({ nivel = 1, className, ...rest }: SurfaceProps) {
  return (
    <div
      className={cx(
        "rounded-v2-md p-5 ring-1 ring-inset ring-v2-azul-luz/15",
        nivel === 1 ? "bg-v2-casco shadow-v2-1" : "bg-v2-casco-alto shadow-v2-2",
        className,
      )}
      {...rest}
    />
  );
}
