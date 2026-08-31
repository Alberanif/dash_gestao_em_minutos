// Busca + filtro client-side da tabela do roster (PRD issue #114, seção
// 3.4). Pura para ser testável sem DOM e para ser reaproveitada pela
// exportação CSV (a visão exportada é exatamente a visão filtrada atual).
import type { UltimatesCategory, UltimatesRosterRow } from "@/types/vendas";

export type CategoryFilter = UltimatesCategory | "todas";

export interface RosterFilterOptions {
  search: string;
  category: CategoryFilter;
}

export function filterRosterRows(
  rows: UltimatesRosterRow[],
  { search, category }: RosterFilterOptions
): UltimatesRosterRow[] {
  const term = search.trim().toLowerCase();

  return rows.filter((row) => {
    if (category !== "todas" && row.category !== category) return false;
    if (!term) return true;

    const name = (row.name ?? "").toLowerCase();
    const email = row.email.toLowerCase();
    return name.includes(term) || email.includes(term);
  });
}
