"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { ID_PAINEL_VISAO } from "./alternar-visao";
import { useEvento } from "./contexto";
import { Esqueleto } from "./bloco";

// Fora do chunk inicial: a rota do evento está colada no orçamento de 180 KB.
const TelaDebriefing = dynamic(() => import("./debriefing/tela-debriefing").then((m) => m.TelaDebriefing), {
  loading: () => <Esqueleto className="h-72 w-full" />,
});

/**
 * Corpo da página: os blocos do Dashboard (vindos do servidor) ou o Debriefing.
 * O Dashboard fica montado e só some (`hidden`) quando a visão é outra: voltar a ele é instantâneo
 * e nenhuma consulta é refeita.
 */
export function CorpoDoEvento({ dashboard }: { dashboard: ReactNode }) {
  const { visao } = useEvento();
  return (
    <div id={ID_PAINEL_VISAO} role="tabpanel" aria-label={visao === "debriefing" ? "Debriefing" : "Dashboard"} className="space-y-8">
      <div hidden={visao !== "dashboard"} className="space-y-8">
        {dashboard}
      </div>
      {visao === "debriefing" ? <TelaDebriefing /> : null}
    </div>
  );
}
