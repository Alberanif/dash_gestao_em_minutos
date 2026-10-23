import { calcPresetDates, getActivePreset, type PresetKey } from "@/lib/utils/period-presets";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function primeiro(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Período da URL (`?de=&ate=`). Data fora do formato, calendário impossível ou início
 * depois do fim caem no padrão (28 dias): a URL nunca quebra a página nem vai ao banco.
 */
export function periodoDaUrl(
  query: { [chave: string]: string | string[] | undefined },
  hoje: string,
): { startDate: string; endDate: string; preset: PresetKey | null } {
  const de = primeiro(query.de);
  const ate = primeiro(query.ate);
  const valido = (d: string | undefined): d is string =>
    d !== undefined && DATA.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

  if (valido(de) && valido(ate) && de <= ate) {
    return { startDate: de, endDate: ate, preset: getActivePreset(de, ate, hoje) };
  }
  return { ...calcPresetDates("28d", hoje), preset: "28d" };
}
