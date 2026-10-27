import Link from "next/link";

/** Volta da Central de links ao menu principal, com o mesmo botão do "Voltar aos eventos" dos indicadores. */
export function BotaoVoltarAoMenu() {
  return (
    <Link href="/v2" className="v2-voltar self-start">
      <span className="v2-voltar-texto">Voltar ao menu</span>
      <span aria-hidden="true" className="v2-voltar-texto-escuro">
        Voltar ao menu
      </span>
    </Link>
  );
}
