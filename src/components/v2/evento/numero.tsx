import { corDado, type Dado } from "../cor";
import { cx } from "../ui/cx";

/**
 * Número de apoio: rótulo e valor com uma haste na cor do dado. O valor continua em branco,
 * a cor fica ao redor dele, para a hierarquia não depender de matiz.
 */
export function Numero({ rotulo, valor, dado, caixa = false }: { rotulo: string; valor: string; dado: Dado; caixa?: boolean }) {
  return (
    <div
      className={cx("relative min-w-0 border-l-2 pl-3", caixa && "rounded-r-v2-sm bg-v2-abismo/50 py-2.5 pr-3")}
      style={{ borderColor: corDado(dado) }}
    >
      <dt className="text-xs text-v2-nevoa/60">{rotulo}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium tabular-nums">{valor}</dd>
    </div>
  );
}
