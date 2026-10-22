export type IconeId =
  | "indicadores"
  | "ultimates"
  | "vendas"
  | "ltv"
  | "social-seller"
  | "eqa"
  | "agente"
  | "ajustes";

export type DestinoNav = {
  id: IconeId;
  rotulo: string;
  /** null = área ainda não migrada: entrada desabilitada, sem link (nunca aponta para o V1). */
  href: string | null;
  /** Prefixos de rota em que o destino conta como ativo. */
  prefixos?: readonly string[];
};

/** Só o Indicadores é destino ativo no piloto; as demais áreas entram por ondas depois. */
export const DESTINOS: readonly DestinoNav[] = [
  { id: "indicadores", rotulo: "Indicadores", href: "/v2", prefixos: ["/v2/indicadores"] },
  { id: "ultimates", rotulo: "Ultimates", href: null },
  { id: "vendas", rotulo: "Vendas", href: null },
  { id: "ltv", rotulo: "LTV", href: null },
  { id: "social-seller", rotulo: "Social seller", href: null },
  { id: "eqa", rotulo: "EQA", href: null },
  { id: "agente", rotulo: "Agente", href: null },
  { id: "ajustes", rotulo: "Ajustes", href: null },
];

export const ROTULO_EM_BREVE = "Em breve";

function normaliza(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function destinoAtivo(destino: DestinoNav, pathname: string): boolean {
  if (!destino.href) return false;
  const p = normaliza(pathname);
  if (p === destino.href) return true;
  return (destino.prefixos ?? []).some((pre) => p === pre || p.startsWith(`${pre}/`));
}

/** Título do cabeçalho para a rota atual. */
export function tituloDaRota(pathname: string): string {
  const p = normaliza(pathname);
  if (p === "/v2/_kit") return "Kit de componentes";
  const ativo = DESTINOS.find((d) => destinoAtivo(d, p));
  return ativo?.rotulo ?? "Dash V2";
}
