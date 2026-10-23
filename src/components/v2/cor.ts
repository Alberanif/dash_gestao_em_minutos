/** Cor por significado do dado (valores em tokens.css). Fora de charts/ de propósito: os blocos usam sem puxar o chunk dos gráficos. */

/** Os tipos de dado com cor própria. A mesma cor vale em qualquer bloco: ícone, valor, gráfico, corda. */
export type Dado = "alcance" | "pagina" | "lead" | "venda" | "custo" | "alerta";

/** Cor do dado, por token. */
export const corDado = (d: Dado): string => `var(--v2-d-${d})`;
