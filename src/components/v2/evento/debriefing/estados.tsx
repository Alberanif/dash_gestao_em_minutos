import Link from "next/link";
import { Button } from "../../ui/button";
import { Esqueleto } from "../bloco";
import { cx, foco } from "../../ui/cx";

/** Esqueleto no formato do conteúdo: chips, superfície de resultado, gráfico e um bloco de produto. */
export function EstadoCarregando() {
  return (
    <div data-testid="debriefing-carregando" role="status" aria-label="Carregando as vendas" className="space-y-6">
      <div className="flex gap-2">
        <Esqueleto className="h-9 w-20 rounded-full" />
        <Esqueleto className="h-9 w-32 rounded-full" />
        <Esqueleto className="h-9 w-28 rounded-full" />
      </div>
      <Esqueleto className="h-40 w-full" />
      <Esqueleto className="h-64 w-full" />
      <Esqueleto className="h-48 w-full" />
    </div>
  );
}

export function EstadoErro({ aoTentarDeNovo, tentando }: { aoTentarDeNovo: () => void; tentando?: boolean }) {
  return (
    <div data-testid="debriefing-erro" role="alert" className="flex flex-col items-start gap-4 rounded-v2-md bg-v2-casco p-6 shadow-v2-1">
      <p className="text-base text-v2-nevoa">Não foi possível carregar as vendas.</p>
      <Button variante="secundario" onClick={aoTentarDeNovo} disabled={tentando}>
        Tentar de novo
      </Button>
    </div>
  );
}

/** `produto` é o complemento já concordado ("de Produto A" ou "dos produtos principais"); `de`/`ate` já formatados (dd/mm). */
export function EstadoSemVendas({ produto, de, ate }: { produto: string; de: string; ate: string }) {
  return (
    <div data-testid="debriefing-sem-vendas" role="status" className="rounded-v2-md bg-v2-casco p-6 shadow-v2-1">
      <p className="text-base text-v2-nevoa">
        Nenhuma venda {produto} entre {de} e {ate}. Tente um período maior.
      </p>
    </div>
  );
}

/** Destino: a lista de eventos, onde mora o diálogo de edição (a página do evento não tem esse diálogo). */
export function EstadoSemProdutoPrincipal() {
  return (
    <div data-testid="debriefing-sem-produto" className="flex flex-col items-start gap-4 rounded-v2-md bg-v2-casco p-6 shadow-v2-1">
      <p className="text-base text-v2-nevoa">Este evento ainda não tem produto principal.</p>
      <Link
        href="/v2/indicadores/eventos"
        className={cx(
          "inline-flex h-10 items-center justify-center rounded-v2-sm bg-v2-azul-igt px-4 text-sm font-medium text-v2-abismo shadow-v2-1",
          foco,
        )}
      >
        Configurar produto principal
      </Link>
    </div>
  );
}
