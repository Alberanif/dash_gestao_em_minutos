import type { FilterRecord } from "@/types/indicadores";
import { utcToBrtDate } from "@/lib/indicadores/timezone";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

/** "2026-03-12T..." (UTC) -> { dia: 12, mes: "mar", ano: 2026 }, no dia de Brasília. */
function partes(iso: string) {
  const [ano, mes, dia] = utcToBrtDate(iso).split("-").map(Number);
  return { dia, mes: MESES[mes - 1], ano };
}

/**
 * Período do dashboard. O evento não guarda início e fim próprios: vale da criação até a
 * mudança de status. Ativo ainda não terminou, então diz só "desde".
 * "desde 12 mar 2026" · "12 mar – 30 jun 2026" · "12 mar 2026 – 5 jan 2027"
 */
export function periodoDoEvento(evento: FilterRecord): string {
  const ini = partes(evento.created_at);
  const inicio = `${ini.dia} ${ini.mes}`;
  if (evento.status === "ativo" || !evento.status_changed_at) return `desde ${inicio} ${ini.ano}`;
  const fim = partes(evento.status_changed_at);
  const mesmoAno = ini.ano === fim.ano;
  return `${mesmoAno ? inicio : `${inicio} ${ini.ano}`} – ${fim.dia} ${fim.mes} ${fim.ano}`;
}
