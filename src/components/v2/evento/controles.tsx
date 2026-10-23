"use client";

import { useRouter } from "next/navigation";
import type { PresetKey } from "@/lib/utils/period-presets";
import { Segmentado } from "./segmentado";
import { cx, foco } from "../ui/cx";
import { useEvento } from "./contexto";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "28d", label: "28 dias" },
  { key: "90d", label: "90 dias" },
  { key: "mes-atual", label: "Mês atual" },
  { key: "mes-anterior", label: "Mês anterior" },
];

const campoData = cx(
  "h-10 min-w-0 rounded-v2-sm bg-v2-casco-alto px-3 text-sm text-v2-nevoa shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15 [color-scheme:dark]",
  foco,
);

/** Evento salvo, período e datas livres. Mexer aqui só atualiza o estado: os blocos refazem as consultas sozinhos. */
export function ControlesDoEvento() {
  const router = useRouter();
  const { filter, filters, periodo, escolherPreset, escolherDatas } = useEvento();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* <select> nativo: zero JS extra (o Select do Radix pesa ~11 KB gzip) e o seletor do sistema no celular. */}
      <select
        aria-label="Evento"
        className={cx(campoData, "min-w-40 max-w-full")}
        value={filter.id}
        onChange={(e) => {
          if (e.target.value !== filter.id) router.push(`/v2/indicadores/${e.target.value}${window.location.search}`);
        }}
      >
        {filters.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <div className="max-w-full overflow-x-auto">
        <Segmentado
          rotulo="Período"
          valor={periodo.preset}
          onChange={escolherPreset}
          opcoes={PRESETS.map((p) => ({ value: p.key, label: p.label }))}
        />
      </div>
      <div className="flex items-center gap-2 text-sm text-v2-nevoa/60">
        <input
          type="date"
          aria-label="Data inicial"
          className={campoData}
          value={periodo.startDate}
          max={periodo.endDate}
          onChange={(e) => escolherDatas(e.target.value, periodo.endDate)}
        />
        <span>até</span>
        <input
          type="date"
          aria-label="Data final"
          className={campoData}
          value={periodo.endDate}
          min={periodo.startDate}
          onChange={(e) => escolherDatas(periodo.startDate, e.target.value)}
        />
      </div>
    </div>
  );
}
