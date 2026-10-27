"use client";

import { Button, Select, Surface } from "../../../ui";
import { DIMENSOES, type DimensaoChave, type FiltrosDoResultado, type ResultadoAb } from "./tipos";

/** O Radix não aceita value vazio num item: "Todos" usa uma sentinela. */
const TODOS = "__todos__";

export function Filtros({
  disponiveis,
  filtros,
  ocupado,
  onMudar,
  onLimpar,
}: {
  disponiveis: ResultadoAb["filtros_disponiveis"] | undefined;
  filtros: FiltrosDoResultado;
  ocupado: boolean;
  onMudar: (dim: DimensaoChave, valor: string) => void;
  onLimpar: () => void;
}) {
  const algum = Object.values(filtros).some(Boolean);
  return (
    <Surface>
      <h2 className="m-0 text-base font-bold text-v2-nevoa">Filtros</h2>
      <p className="m-0 mt-1 text-xs text-v2-nevoa/60">Recortam todos os números abaixo (menos a saúde da instalação).</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {DIMENSOES.map((d) => {
          const atual = filtros[d.chave] ?? "";
          const lista = [...(disponiveis?.[d.chave] ?? [])];
          if (atual && !lista.includes(atual)) lista.push(atual);
          return (
            <div key={d.chave} className="flex flex-col gap-1">
              <span className="text-xs text-v2-nevoa/65">{d.rotulo}</span>
              <Select
                aria-label={d.rotulo}
                value={atual || TODOS}
                disabled={ocupado}
                onValueChange={(v) => onMudar(d.chave, v === TODOS ? "" : v)}
                opcoes={[{ value: TODOS, label: "Todos" }, ...lista.map((x) => ({ value: x, label: x }))]}
              />
            </div>
          );
        })}
        <Button variante="secundario" disabled={!algum || ocupado} onClick={onLimpar}>
          Limpar filtros
        </Button>
      </div>
    </Surface>
  );
}
