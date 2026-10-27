import type { Dado } from "../cor";
import type { NomeIcone } from "./icones";

/** Etapas da jornada, na ordem do funil: impressões, cliques, página, leads, vendas. */
export const ETAPAS: ReadonlyArray<{ dado: Dado; icone: NomeIcone }> = [
  { dado: "alcance", icone: "impressoes" },
  { dado: "alcance", icone: "cliques" },
  { dado: "pagina", icone: "pagina" },
  { dado: "lead", icone: "leads" },
  { dado: "venda", icone: "vendas" },
];
