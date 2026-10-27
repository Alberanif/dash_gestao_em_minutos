import { Esqueleto } from "@/components/v2/evento/bloco";

/** Esqueleto da tela: aparece no primeiro byte, antes de qualquer consulta ao banco. */
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando evento" className="mx-auto max-w-6xl space-y-8 pt-2">
      <Esqueleto className="h-40 w-full @xl:h-56" />
      <div className="flex flex-wrap gap-3">
        <Esqueleto className="h-10 w-48" />
        <Esqueleto className="h-10 w-80 max-w-full" />
      </div>
      <Esqueleto className="h-32 w-full" />
      <Esqueleto className="h-72 w-full" />
    </div>
  );
}
