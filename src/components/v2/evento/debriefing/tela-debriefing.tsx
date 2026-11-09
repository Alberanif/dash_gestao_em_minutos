"use client";

import { Esqueleto } from "../bloco";

/** Ponto de entrada da visão Debriefing (carregado sob demanda). Os blocos seguintes entram aqui. */
export function TelaDebriefing() {
  return (
    <section aria-label="Debriefing" data-testid="tela-debriefing">
      <Esqueleto className="h-72 w-full" />
    </section>
  );
}
