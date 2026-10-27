import Link from "next/link";
import type { CSSProperties, ReactElement } from "react";
import { cx, foco } from "../ui/cx";

export type CartaoDoMenu = {
  id: string;
  /** Destino do link. Sem `href` o cartão é um botão que encerra a sessão. */
  href?: string;
  titulo: string;
  icone: ReactElement;
  descricao: string;
  /** Cor de destaque do cartão: borda da capa e manchas do verso. */
  destaque: string;
  /** Cartão ainda sem destino: aparece apagado, com selo "Em breve", e não leva a lugar nenhum. */
  emBreve?: boolean;
  /** Configuração é menor que as áreas de trabalho, para separar uma da outra. */
  tamanho: "grande" | "pequeno" | "mini";
};

function Faces({ c }: { c: CartaoDoMenu }) {
  return (
    <div className="v2-menu-miolo">
      <div className="v2-menu-face v2-menu-capa">
        <div className="v2-menu-capa-corpo">
          <span className="v2-menu-icone" aria-hidden="true">
            {c.icone}
          </span>
          <p className="v2-menu-nome">{c.titulo}</p>
          {c.emBreve && <span className="v2-menu-selo">Em breve</span>}
        </div>
      </div>
      <div className="v2-menu-face v2-menu-verso">
        <span className="v2-menu-mancha v2-menu-mancha--a" />
        <span className="v2-menu-mancha v2-menu-mancha--b" />
        <span className="v2-menu-mancha v2-menu-mancha--c" />
        <div className="v2-menu-texto">
          <p className="v2-menu-nome">{c.titulo}</p>
          <p className="v2-menu-desc">{c.descricao}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Cartão com giro 3D, compartilhado pelo menu principal e pelo hub de Ajustes. Vira link, bloco sem destino
 * ("em breve") ou botão de logout conforme o cartão. O CSS vive em menu-principal.css.
 */
export function CartaoGiro({ c }: { c: CartaoDoMenu }) {
  const classe = cx(
    "v2-menu-card",
    c.tamanho === "pequeno" && "v2-menu-card--pequeno",
    c.tamanho === "mini" && "v2-menu-card--mini",
    c.emBreve && "v2-menu-card--em-breve",
    foco,
  );
  const estilo = { "--destaque": c.destaque } as CSSProperties;
  if (c.emBreve) {
    return (
      <div aria-disabled="true" className={classe} style={estilo}>
        <Faces c={c} />
      </div>
    );
  }
  if (c.href) {
    return (
      <Link href={c.href} className={classe} style={estilo}>
        <Faces c={c} />
      </Link>
    );
  }
  return (
    <form action="/api/auth/signout" method="post" className="v2-menu-form">
      <button type="submit" className={classe} style={estilo}>
        <Faces c={c} />
      </button>
    </form>
  );
}
