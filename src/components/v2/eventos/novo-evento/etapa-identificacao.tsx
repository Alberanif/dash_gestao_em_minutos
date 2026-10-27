"use client";

import { Campo, Input } from "../../ui";
import { validateEventPeriod } from "@/lib/indicadores/event-period";
import type { PropsEtapa } from "./estado";

export function EtapaIdentificacao({ estado, atualizar }: PropsEtapa) {
  const periodo = validateEventPeriod(estado.inicio, estado.fim);
  const erroPeriodo = periodo.ok ? null : periodo.error;
  const idErro = "novo-evento-periodo-erro";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-v2-nevoa">Identificação</h3>
        <p className="text-sm text-v2-nevoa/65">Dê um nome ao evento e, se quiser, marque quando ele acontece.</p>
      </header>

      <Campo rotulo="Nome do evento">
        {(a) => (
          <Input
            {...a}
            className="h-11"
            autoFocus
            placeholder="Ex.: Imersão Mentoria"
            value={estado.nome}
            onChange={(e) => atualizar({ nome: e.target.value })}
          />
        )}
      </Campo>

      <fieldset className="flex flex-col gap-2" aria-describedby={erroPeriodo ? idErro : undefined}>
        <legend className="mb-1.5 text-[13px] font-medium text-v2-nevoa/70">Período do evento (opcional)</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo rotulo="Início" erro={!!erroPeriodo}>
            {(a) => (
              <Input
                {...a}
                className="h-11"
                type="date"
                aria-label="Data de início"
                value={estado.inicio}
                onChange={(e) => atualizar({ inicio: e.target.value })}
              />
            )}
          </Campo>
          <Campo rotulo="Fim" erro={!!erroPeriodo}>
            {(a) => (
              <Input
                {...a}
                className="h-11"
                type="date"
                aria-label="Data de fim"
                value={estado.fim}
                onChange={(e) => atualizar({ fim: e.target.value })}
              />
            )}
          </Campo>
        </div>
        {erroPeriodo ? (
          <p id={idErro} role="alert" className="text-xs text-v2-queda">
            {erroPeriodo}
          </p>
        ) : (
          <p className="text-xs text-v2-nevoa/55">Deixe em branco para o dashboard abrir nos últimos 28 dias.</p>
        )}
      </fieldset>
    </div>
  );
}
