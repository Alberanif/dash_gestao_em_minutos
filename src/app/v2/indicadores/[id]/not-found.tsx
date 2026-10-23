import Link from "next/link";
import { Surface } from "@/components/v2/ui/surface";
import { cx, foco } from "@/components/v2/ui/cx";

export default function NotFound() {
  return (
    <Surface className="mx-auto mt-2 max-w-xl">
      <h2 className="text-lg font-semibold">Evento não encontrado</h2>
      <p className="mt-2 text-sm text-v2-nevoa/70">O link pode estar incorreto ou o evento foi excluído.</p>
      <Link
        href="/v2/indicadores/eventos"
        className={cx(
          "mt-4 inline-flex h-10 items-center rounded-v2-sm bg-v2-azul-igt px-4 text-sm font-medium text-v2-abismo shadow-v2-1",
          foco,
        )}
      >
        Ver todos os eventos
      </Link>
    </Surface>
  );
}
