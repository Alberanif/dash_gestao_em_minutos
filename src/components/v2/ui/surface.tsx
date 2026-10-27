import { cx } from "./cx";

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Nível de profundidade: 1 repouso, 2 elevado. */
  nivel?: 1 | 2;
};

/** Card de superfície: nível 1 é fosco e sólido; nível 2 flutua e ganha vidro fosco. */
export function Surface({ nivel = 1, className, ...rest }: SurfaceProps) {
  return (
    <div
      className={cx(
        "rounded-v2-md p-5 ring-1 ring-inset ring-v2-azul-luz/25",
        nivel === 1 ? "bg-v2-casco shadow-v2-1" : "v2-vidro",
        className,
      )}
      {...rest}
    />
  );
}
