import type { PapelCentral } from "@/lib/central-de-links/papel";
import { CardMenu } from "./card-menu";
import { itensVisiveis } from "./itens";

/** Menu principal dos Indicadores: uma grade de cards, que cresce conforme entram novos itens. */
export function MenuIndicadores({ papelCentral = null }: { papelCentral?: PapelCentral | null }) {
  return (
    <div className="mt-2 space-y-8">
      <p className="max-w-prose text-sm text-v2-nevoa/60">Escolha o que você quer acompanhar.</p>
      <ul aria-label="Áreas dos indicadores" className="grid grid-cols-1 gap-6 @xl:grid-cols-[repeat(auto-fill,18rem)]">
        {itensVisiveis(papelCentral).map((item) => (
          <li key={item.id}>
            <CardMenu item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}
