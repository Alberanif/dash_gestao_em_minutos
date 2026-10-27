import type { Account } from "@/types/accounts";

export type Plataforma = Account["platform"];

/** Ordem e rótulos iguais aos do V1. */
export const PLATAFORMAS: ReadonlyArray<{ chave: Plataforma; rotulo: string }> = [
  { chave: "youtube", rotulo: "YouTube" },
  { chave: "instagram", rotulo: "Instagram" },
  { chave: "meta-ads", rotulo: "Meta Ads" },
  { chave: "hotmart", rotulo: "Hotmart" },
];

export const ROTULO_PLATAFORMA: Record<Plataforma, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  "meta-ads": "Meta Ads",
  hotmart: "Hotmart",
};
