/** Os `limite` maiores itens por contagem; o resto soma em "Outros" (e some se não houver resto). */
export function topComOutros<T extends { label: string; value: number }>(
  itens: T[],
  limite = 5,
): { id: string; label: string; value: number }[] {
  const ordenados = [...itens].sort((a, b) => b.value - a.value);
  const topo = ordenados.slice(0, limite).map((i, idx) => ({ id: String(idx), label: i.label, value: i.value }));
  const resto = ordenados.slice(limite).reduce((soma, i) => soma + i.value, 0);
  return resto > 0 ? [...topo, { id: "outros", label: "Outros", value: resto }] : topo;
}
