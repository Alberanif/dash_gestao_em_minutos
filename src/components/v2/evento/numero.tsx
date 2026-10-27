import { corDado, type Dado } from "../cor";
import { cx } from "../ui/cx";

/**
 * Número de apoio: rótulo e valor com uma haste na cor do dado. O valor continua em branco,
 * a cor fica ao redor dele, para a hierarquia não depender de matiz. "plataforma" usa a cor da aba
 * (var(--plat), definida em .v2-plat).
 */
export function Numero({ rotulo, valor, dado, caixa = false }: { rotulo: string; valor: string; dado: Dado | "plataforma"; caixa?: boolean }) {
  return (
    <div
      className={cx("@container relative min-w-0 border-l-[3px] pl-3", caixa && "rounded-r-v2-sm bg-v2-abismo/50 py-2.5 pr-3")}
      style={{ borderColor: dado === "plataforma" ? "var(--plat)" : corDado(dado) }}
    >
      <dt className="truncate text-xs text-v2-nevoa/60" title={rotulo}>
        {rotulo}
      </dt>
      {/* nowrap: o Intl separa "R$" do número com NBSP, mas um espaço comum quebraria o valor ao meio.
          A fonte acompanha a largura do cartão (cqi) e só então, em último caso, reticências. */}
      <dd className="mt-0.5 whitespace-nowrap font-medium tabular-nums truncate" style={{ fontSize: "clamp(0.75rem, 9cqi, 0.9375rem)" }}>
        {valor}
      </dd>
    </div>
  );
}
