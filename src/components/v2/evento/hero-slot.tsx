import type { FilterStatus } from "@/types/indicadores";
import { cx } from "../ui/cx";
import { HeroLuz } from "./hero-luz";

const STATUS: Record<FilterStatus, string> = {
  ativo: "Ativo",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

/**
 * Herói do evento: um feixe de luz azul que desce até o ponto âmbar. O feixe é CSS no
 * servidor e vira WebGL no cliente (HeroLuz); o ponto é sempre DOM, então o âmbar nunca
 * entra no shader. O espaço (altura, rótulo e posição) é o mesmo nos dois modos.
 */
export function HeroSlot({ nome, status }: { nome: string; status: FilterStatus }) {
  return (
    <div
      data-hero-slot
      className="relative isolate overflow-hidden rounded-v2-md bg-v2-casco px-5 py-8 shadow-v2-2 ring-1 ring-inset ring-v2-azul-luz/15 @xl:px-8 @xl:py-12"
    >
      <HeroLuz />
      <span
        aria-hidden="true"
        data-hero-ponto
        className="absolute bottom-6 right-[calc(12%+2.75rem)] size-3 rounded-full bg-v2-ponto shadow-v2-brilho-ponto @xl:right-[calc(18%+4.75rem)]"
      />
      <p className="text-sm text-v2-nevoa/70">
        <span className={cx(status === "ativo" && "text-v2-azul-luz")}>{STATUS[status]}</span>
      </p>
      <h2 className="mt-2 max-w-[22ch] text-3xl font-light leading-tight tracking-tight @xl:text-5xl">{nome}</h2>
    </div>
  );
}
