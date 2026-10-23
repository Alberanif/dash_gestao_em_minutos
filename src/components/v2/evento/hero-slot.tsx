import type { FilterStatus } from "@/types/indicadores";
import { cx } from "../ui/cx";

const STATUS: Record<FilterStatus, string> = {
  ativo: "Ativo",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

/**
 * Espaço do herói do evento. Hoje é só CSS: um feixe de luz azul que desce até o ponto
 * âmbar. A #260 troca o conteúdo por WebGL com este mesmo fallback, sem mexer na tela
 * ao redor: o espaço (altura, rótulo e posição) já está fixo aqui.
 */
export function HeroSlot({ nome, status }: { nome: string; status: FilterStatus }) {
  return (
    <div
      data-hero-slot
      className="relative isolate overflow-hidden rounded-v2-md bg-v2-casco px-5 py-8 shadow-v2-2 ring-1 ring-inset ring-v2-azul-luz/15 @xl:px-8 @xl:py-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-[12%] -z-10 w-24 bg-gradient-to-b from-v2-azul-luz/0 via-v2-azul-luz/25 to-v2-azul-luz/0 blur-2xl @xl:right-[18%] @xl:w-40"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-6 right-[calc(12%+2.75rem)] size-3 rounded-full bg-v2-ponto shadow-v2-brilho-ponto @xl:right-[calc(18%+4.75rem)]"
      />
      <p className="text-sm text-v2-nevoa/70">
        <span className={cx(status === "ativo" && "text-v2-azul-luz")}>{STATUS[status]}</span>
      </p>
      <h2 className="mt-2 max-w-[22ch] text-3xl font-light leading-tight tracking-tight @xl:text-5xl">{nome}</h2>
    </div>
  );
}
