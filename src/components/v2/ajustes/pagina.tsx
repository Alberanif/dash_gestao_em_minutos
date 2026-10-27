import Link from "next/link";

/**
 * Moldura das telas internas de Ajustes: link de volta ao hub, título e subtítulo. A largura máxima e o
 * respiro seguem o V2Shell; o conteúdo de cada tela entra como filhos.
 */
export function PaginaAjustes({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-6">
      <header className="v2-entra flex flex-col gap-3">
        <Link
          href="/v2/ajustes"
          className="inline-flex w-fit items-center gap-1.5 rounded-v2-sm text-sm font-medium text-v2-azul-luz focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-azul-luz"
        >
          <span aria-hidden="true">←</span> Ajustes
        </Link>
        <div>
          <h1 className="m-0 text-[clamp(1.5rem,4vw,2rem)] font-bold tracking-tight">{titulo}</h1>
          <p className="mt-1 text-sm text-v2-nevoa/65">{subtitulo}</p>
        </div>
      </header>
      {children}
    </div>
  );
}
