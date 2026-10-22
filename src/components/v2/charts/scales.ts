/**
 * Escalas mínimas dos gráficos. Existem no lugar do @visx/scale (que arrasta d3-scale,
 * d3-interpolate, d3-time e d3-format, cerca de 20 KB gzip) porque o orçamento da V2 é de 180 KB por rota
 * e os gráficos só precisam de escala linear, de bandas e de marcas de data.
 */

export type EscalaLinear = {
  (valor: number): number;
  domain(): [number, number];
  range(): [number, number];
  invert(px: number): number;
  ticks(quantos: number): number[];
};

/** Passo "redondo" (1, 2, 5 × 10ⁿ) para cobrir [lo, hi] com cerca de `quantos` marcas. */
export function passoRedondo(lo: number, hi: number, quantos: number): number {
  const bruto = (hi - lo) / Math.max(1, quantos);
  if (!(bruto > 0) || !Number.isFinite(bruto)) return 1;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const erro = bruto / pot;
  // Limiares geométricos de 1, 2, 5 e 10 (√50, √10, √2), como no d3.
  const mult = erro >= 7.0710678 ? 10 : erro >= 3.1622777 ? 5 : erro >= 1.4142136 ? 2 : 1;
  return mult * pot;
}

/** Marcas redondas dentro de [lo, hi]. */
export function marcasLineares(lo: number, hi: number, quantos: number): number[] {
  if (lo === hi) return [lo];
  const passo = passoRedondo(lo, hi, quantos);
  const out: number[] = [];
  const inicio = Math.ceil(lo / passo - 1e-9);
  for (let i = inicio; i * passo <= hi + passo * 1e-9; i++) out.push(Number((i * passo).toPrecision(12)));
  return out;
}

export function escalaLinear(dominio: [number, number], faixa: [number, number], opcoes: { nice?: boolean } = {}): EscalaLinear {
  let [d0, d1] = dominio;
  if (opcoes.nice && d0 !== d1) {
    const passo = passoRedondo(d0, d1, 4);
    d0 = Math.floor(d0 / passo + 1e-9) * passo;
    d1 = Math.ceil(d1 / passo - 1e-9) * passo;
  }
  const [r0, r1] = faixa;
  const span = d1 - d0;
  const escala = ((v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0))) as EscalaLinear;
  escala.domain = () => [d0, d1];
  escala.range = () => [r0, r1];
  escala.invert = (px) => (r1 === r0 ? d0 : d0 + ((px - r0) / (r1 - r0)) * span);
  escala.ticks = (quantos) => marcasLineares(d0, d1, quantos);
  return escala;
}

const DIA = 86_400_000;
const HORA = 3_600_000;
const PASSOS_DIAS = [1, 2, 3, 7, 14, 30, 60, 90, 180, 365];
const PASSOS_HORAS = [1, 2, 3, 6, 12];

/** Marcas em início de dia (ou de hora, em janelas curtas) no fuso local, com no máximo `quantos` marcas. */
export function marcasDeData(lo: number, hi: number, quantos: number): number[] {
  const n = Math.max(1, quantos);
  const out: number[] = [];
  if (hi - lo < 2 * DIA) {
    const passoH = PASSOS_HORAS.find((h) => (hi - lo) / (h * HORA) <= n) ?? 24;
    const d = new Date(lo);
    d.setMinutes(0, 0, 0);
    while (d.getTime() < lo) d.setHours(d.getHours() + 1);
    for (; d.getTime() <= hi; d.setHours(d.getHours() + passoH)) out.push(d.getTime());
    return out;
  }
  const passoD = PASSOS_DIAS.find((p) => (hi - lo) / (p * DIA) <= n) ?? 365;
  const d = new Date(lo);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() < lo) d.setDate(d.getDate() + 1);
  for (; d.getTime() <= hi; d.setDate(d.getDate() + passoD)) out.push(d.getTime());
  return out;
}

export type EscalaBanda = {
  (id: string): number | undefined;
  step(): number;
  bandwidth(): number;
};

/** Faixas de largura igual para categorias, com o mesmo espaçamento interno e externo (padrão do d3 scaleBand). */
export function escalaBanda(ids: ReadonlyArray<string>, faixa: [number, number], padding: number): EscalaBanda {
  const n = ids.length;
  const [a, b] = faixa;
  const passo = (b - a) / Math.max(1, n - padding + padding * 2);
  const inicio = a + (b - a - passo * (n - padding)) / 2;
  const indice = new Map(ids.map((id, i) => [id, i]));
  const escala = ((id: string) => {
    const i = indice.get(id);
    return i === undefined ? undefined : inicio + passo * i;
  }) as EscalaBanda;
  escala.step = () => passo;
  escala.bandwidth = () => passo * (1 - padding);
  return escala;
}
