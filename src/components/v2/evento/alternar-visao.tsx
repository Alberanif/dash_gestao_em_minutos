"use client";

import { Segmentado } from "./segmentado";
import { useEvento } from "./contexto";
import { VISOES } from "./visao";

export const ID_PAINEL_VISAO = "painel-visao";

/** Dashboard | Debriefing na barra de vidro do herói. Só troca o corpo; o herói não é refeito. */
export function AlternarVisao() {
  const { visao, escolherVisao } = useEvento();
  return (
    <div className="grid min-w-0 max-w-full gap-1.5">
      <span className="text-xs text-v2-nevoa/60">Visão</span>
      <Segmentado vidro rotulo="Visão" idPainel={ID_PAINEL_VISAO} valor={visao} onChange={escolherVisao} opcoes={VISOES} />
    </div>
  );
}
