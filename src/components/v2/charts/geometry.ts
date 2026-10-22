/** Funções puras dos gráficos: dados limpos, domínios, busca do ponto mais próximo e formatação. */

export type XValue = Date | number;
export type XY = { x: number; y: number };

export const toX = (v: XValue): number => (v instanceof Date ? v.getTime() : v);

/** Descarta pontos não finitos e ordena por x. Dado sujo nunca derruba o gráfico. */
export function cleanPoints(data: ReadonlyArray<{ x: XValue; y: number }>): XY[] {
  const out: XY[] = [];
  for (const d of data) {
    const x = toX(d.x);
    if (Number.isFinite(x) && Number.isFinite(d.y)) out.push({ x, y: d.y });
  }
  return out.sort((a, b) => a.x - b.x);
}

/** Índice do valor de `xs` (ordenado) mais próximo de `alvo`. `xs` não pode ser vazio. */
export function nearestIndex(xs: ReadonlyArray<number>, alvo: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < alvo) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(xs[lo - 1] - alvo) <= Math.abs(xs[lo] - alvo)) return lo - 1;
  return lo;
}

/** Domínio de x. Com um único ponto (min = max) abre uma folga para o ponto não colar na borda. */
export function xDomain(xs: ReadonlyArray<number>, folga: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of xs) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  if (lo === Infinity) return [0, 1];
  if (lo === hi) return [lo - folga, hi + folga];
  return [lo, hi];
}

/** Domínio de y: parte do zero quando tudo é não negativo (área honesta) e nunca fica com altura nula. */
export function yDomain(values: ReadonlyArray<number>): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === Infinity) return [0, 1];
  if (lo > 0) lo = 0;
  if (hi < 0) hi = 0;
  if (lo === hi) hi = lo + 1;
  return [lo, hi];
}

/** Mantém os `max - 1` maiores itens (na ordem original) e funde o resto em "Outros". */
export function foldTail<T extends { id: string; label: string; value: number }>(
  items: ReadonlyArray<T>,
  max: number,
  rotulo = "Outros",
): Array<T | { id: string; label: string; value: number; outros: true }> {
  const validos = items.filter((i) => Number.isFinite(i.value) && i.value > 0);
  if (validos.length <= max) return validos;
  const manter = new Set(
    [...validos]
      .sort((a, b) => b.value - a.value)
      .slice(0, max - 1)
      .map((i) => i.id),
  );
  const fica = validos.filter((i) => manter.has(i.id));
  const soma = validos.filter((i) => !manter.has(i.id)).reduce((s, i) => s + i.value, 0);
  return [...fica, { id: "__outros", label: rotulo, value: soma, outros: true as const }];
}

export type EtapaFunil = { pctDoTotal: number; pctDaAnterior: number | null };

/** Conversão de cada etapa em relação à primeira e à anterior. Divisão por zero vira 0, nunca NaN. */
export function etapasFunil(values: ReadonlyArray<number>): EtapaFunil[] {
  const primeiro = values[0] ?? 0;
  return values.map((v, i) => ({
    pctDoTotal: primeiro > 0 ? v / primeiro : 0,
    pctDaAnterior: i === 0 ? null : values[i - 1] > 0 ? v / values[i - 1] : 0,
  }));
}

/** Passo (1 a 5) da rampa ordinal do funil para a etapa `i` de `n`, espalhando as etapas pela rampa. */
export function passoFunil(i: number, n: number): number {
  if (n <= 1) return 1;
  return Math.round((i * 4) / (n - 1)) + 1;
}

export type LadoArredondado = "topo" | "base" | "esquerda" | "direita";

/** Caminho de um retângulo com 4px de raio só na ponta do dado; a base fica reta. */
export function caminhoBarra(x: number, y: number, w: number, h: number, raio: number, ponta: LadoArredondado): string {
  const r = Math.max(0, Math.min(raio, w / 2, h / 2));
  const x2 = x + w;
  const y2 = y + h;
  if (r === 0) return `M${x},${y}H${x2}V${y2}H${x}Z`;
  switch (ponta) {
    case "topo":
      return `M${x},${y2}V${y + r}Q${x},${y} ${x + r},${y}H${x2 - r}Q${x2},${y} ${x2},${y + r}V${y2}Z`;
    case "base":
      return `M${x},${y}V${y2 - r}Q${x},${y2} ${x + r},${y2}H${x2 - r}Q${x2},${y2} ${x2},${y2 - r}V${y}Z`;
    case "direita":
      return `M${x},${y}H${x2 - r}Q${x2},${y} ${x2},${y + r}V${y2 - r}Q${x2},${y2} ${x2 - r},${y2}H${x}Z`;
    case "esquerda":
      return `M${x2},${y}H${x + r}Q${x},${y} ${x},${y + r}V${y2 - r}Q${x},${y2} ${x + r},${y2}H${x2}Z`;
  }
}

const nfCompacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const nfInteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const dfCurto = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const dfLongo = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** 0 / 1 mil / 1,2 mi: para eixos. */
export const formatarCompacto = (n: number): string => nfCompacto.format(n);
/** Valor completo em pt-BR: para tooltip e leitor de tela. */
export const formatarValor = (n: number): string => nfInteiro.format(n);
export const formatarPercentual = (fracao: number): string =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(fracao * 100)}%`;
export const formatarDataCurta = (ms: number): string => dfCurto.format(new Date(ms)).replace(".", "");
export const formatarDataLonga = (ms: number): string => dfLongo.format(new Date(ms));
