export type Visao = "dashboard" | "debriefing";

export const VISOES: { value: Visao; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "debriefing", label: "Debriefing" },
];

/** Visão da URL (`?view=`). Ausente ou desconhecida cai em `dashboard`: a URL nunca quebra a página. */
export function visaoDaUrl(query: { [chave: string]: string | string[] | undefined }): Visao {
  const v = Array.isArray(query.view) ? query.view[0] : query.view;
  return v === "debriefing" ? "debriefing" : "dashboard";
}
