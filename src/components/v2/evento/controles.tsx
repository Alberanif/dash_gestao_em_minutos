"use client";

import type { PresetKey } from "@/lib/utils/period-presets";
import { Segmentado } from "./segmentado";
import { cx, foco } from "../ui/cx";
import { AtualizarAgora } from "./atualizar-agora";
import { useEvento } from "./contexto";

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "28d", label: "28 dias" },
  { key: "90d", label: "90 dias" },
  { key: "mes-atual", label: "Mês atual" },
  { key: "mes-anterior", label: "Mês anterior" },
];

const campo = cx(
  "h-10 min-w-0 rounded-v2-sm bg-v2-abismo/40 px-3 text-sm text-v2-nevoa ring-1 ring-inset ring-v2-azul-luz/20 [color-scheme:dark] hover:ring-v2-azul-luz/40",
  foco,
);

const rotulo = "text-xs text-v2-nevoa/60";

/** Período e datas livres, na barra de vidro do herói. Mexer aqui só atualiza o estado: os blocos refazem as consultas sozinhos. */
export function ControlesDoEvento() {
  const { periodo, escolherPreset, escolherDatas } = useEvento();

  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <div className="grid min-w-0 max-w-full gap-1.5">
        <span className={rotulo}>Período</span>
        <Segmentado
          vidro
          rotulo="Período"
          valor={periodo.preset}
          onChange={escolherPreset}
          opcoes={PRESETS.map((p) => ({ value: p.key, label: p.label }))}
        />
      </div>
      <div className="grid w-full min-w-0 gap-1.5 @xl:w-auto">
        <span className={rotulo}>Datas</span>
        <div className="flex min-w-0 items-center gap-2 text-sm text-v2-nevoa/60">
          <input
            type="date"
            aria-label="Data inicial"
            className={cx(campo, "flex-1")}
            value={periodo.startDate}
            max={periodo.endDate}
            onChange={(e) => escolherDatas(e.target.value, periodo.endDate)}
          />
          <span>até</span>
          <input
            type="date"
            aria-label="Data final"
            className={cx(campo, "flex-1")}
            value={periodo.endDate}
            min={periodo.startDate}
            onChange={(e) => escolherDatas(periodo.startDate, e.target.value)}
          />
        </div>
      </div>
      <AtualizarAgora />
    </div>
  );
}
