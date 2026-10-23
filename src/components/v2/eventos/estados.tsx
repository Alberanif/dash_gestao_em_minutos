import Link from "next/link";
import { Surface } from "../ui/surface";
import { cx, foco } from "../ui/cx";

const bloco = "rounded-v2-sm bg-v2-casco-alto/60 motion-safe:animate-pulse";

/** Mesmo tamanho das células reais, para a troca não deslocar o layout. */
export function MetricasSkeleton() {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-v2-sm bg-v2-abismo/60 px-2 py-2.5">
          <div className={cx(bloco, "mx-auto h-3 w-1/2")} />
          <div className={cx(bloco, "mx-auto mt-2 h-4 w-3/4")} />
        </div>
      ))}
    </div>
  );
}

/** Esqueleto da tela inteira: aparece no primeiro byte, antes de qualquer consulta. */
export function EventosSkeleton() {
  return (
    <div role="status" aria-label="Carregando eventos" className="mt-2 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={cx(bloco, "h-7 w-40")} />
        <div className={cx(bloco, "h-10 w-full @md:w-64")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cx(bloco, "h-20")} />
        ))}
      </div>
      <div className="space-y-4">
        <div className={cx(bloco, "h-6 w-56")} />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {[0, 1, 2].map((i) => (
            <Surface key={i} className="space-y-3">
              <div className={cx(bloco, "h-5 w-2/3")} />
              <div className={cx(bloco, "h-3 w-1/2")} />
              <MetricasSkeleton />
            </Surface>
          ))}
        </div>
      </div>
    </div>
  );
}

const acao = cx(
  "inline-flex h-10 items-center justify-center rounded-v2-sm bg-v2-azul-igt px-4 text-sm font-medium text-v2-abismo shadow-v2-1",
  foco,
);

/** Conta sem nenhum evento. A criação de eventos ainda mora na versão atual. */
export function EventosVazio() {
  return (
    <Surface className="mt-2 max-w-xl">
      <h2 className="text-lg font-semibold">Nenhum evento ainda</h2>
      <p className="mt-2 text-sm text-v2-nevoa/70">
        Crie o primeiro evento na versão atual do Indicadores. Ele aparece aqui assim que for salvo.
      </p>
      <Link href="/indicadores/eventos" className={cx(acao, "mt-4")}>
        Criar evento
      </Link>
    </Surface>
  );
}

/** Falha ao ler os eventos. Recarregar a mesma rota refaz a consulta. */
export function EventosErro() {
  return (
    <Surface className="mt-2 max-w-xl" role="alert">
      <h2 className="text-lg font-semibold">Não foi possível carregar os eventos</h2>
      <p className="mt-2 text-sm text-v2-nevoa/70">
        A conexão com os dados falhou. Tente de novo; se continuar, avise quem cuida do painel.
      </p>
      <a href="/v2/indicadores/eventos" className={cx(acao, "mt-4")}>
        Tentar de novo
      </a>
    </Surface>
  );
}
