import Link from "next/link";
import "./voltar-icone.css";

type Props = {
  /** Tela anterior. */
  href: string;
  /** Nome acessível do botão, ex.: "Voltar ao menu". */
  rotulo: string;
};

/**
 * Botão quadrado só com seta, para voltar à tela anterior (base: Uiverse.io, vinodjangid07).
 * No hover o fundo escuro gira atrás da moldura e a moldura se preenche.
 */
export function BotaoVoltarIcone({ href, rotulo }: Props) {
  return (
    <Link href={href} aria-label={rotulo} title={rotulo} className="v2-voltar-icone" data-testid="voltar-icone">
      <span aria-hidden="true" className="v2-voltar-icone-fundo" />
      <span aria-hidden="true" className="v2-voltar-icone-moldura">
        <span className="v2-voltar-icone-brilho" />
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="v2-voltar-icone-seta">
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
      </span>
    </Link>
  );
}
