// Estatística do Teste A/B: teste z de duas proporções (bicaudal), cada variante contra o controle.
// Módulo puro, sem dependências. Porte fiel de CENTRAL_DE_LINKS/api/_estatistica.js.

export const CONFIANCA_MINIMA = 0.95;
export const AMOSTRA_MINIMA = 100;
const Z_ALFA = 1.959964; // bicaudal 95%
const Z_PODER = 0.841621; // poder 80%
const EFEITO_RELATIVO_MINIMO = 0.2; // ao estimar amostra, não assume efeito menor que 20% relativo

export type VarianteEntrada = {
  id: string;
  controle?: boolean;
  visitantes: number;
  leads: number;
};

export type VereditoVariante = "vencedor" | "perdedor" | "sem_diferenca" | "cedo_demais";
export type VereditoGeral = "vencedor" | "sem_diferenca" | "cedo_demais";

export type VarianteComparada = {
  id: string;
  controle: boolean;
  visitantes: number;
  leads: number;
  taxa: number;
  // null no controle
  diferenca_abs: number | null;
  diferenca_rel: number | null;
  p_valor: number | null;
  confianca: number | null;
  amostra_necessaria: number | null;
  faltam: number | null;
  veredito: VereditoVariante | null;
};

export type ResultadoComparacao = {
  confianca_minima: number;
  amostra_minima: number;
  controle_id: string | null;
  variantes: VarianteComparada[];
  veredito: VereditoGeral;
  vencedor_id: string | null;
  avisos: string[];
};

// erfc com erro relativo < 1,2e-7 (Numerical Recipes)
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? r : 2 - r;
}

export function pValorBicaudal(z: number): number {
  return Math.min(1, erfc(Math.abs(z) / Math.SQRT2));
}

type Normalizada = { id: string; controle: boolean; visitantes: number; leads: number };

function taxaDe(v: { visitantes: number; leads: number }): number {
  return v.visitantes > 0 ? v.leads / v.visitantes : 0;
}

// Visitantes por variante para detectar p1 vs p2 (confiança 95%, poder 80%).
export function amostraNecessaria(p1: number, p2: number): number {
  const d = Math.abs(p2 - p1);
  if (!(d > 0)) return Infinity;
  const pm = (p1 + p2) / 2;
  const a = Z_ALFA * Math.sqrt(2 * pm * (1 - pm));
  const b = Z_PODER * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil(((a + b) * (a + b)) / (d * d));
}

function compararUma(ctrl: Normalizada, v: Normalizada) {
  const pc = taxaDe(ctrl);
  const pv = taxaDe(v);
  const dif = pv - pc;
  const out: {
    diferenca_abs: number;
    diferenca_rel: number | null;
    p_valor: number | null;
    confianca: number | null;
    amostra_necessaria: number;
    faltam: number;
    veredito: VereditoVariante;
  } = {
    diferenca_abs: dif,
    diferenca_rel: pc > 0 ? dif / pc : null,
    p_valor: null,
    confianca: null,
    amostra_necessaria: 0,
    faltam: 0,
    veredito: "cedo_demais",
  };

  // Efeito usado na estimativa de amostra: o observado, mas nunca menor que o mínimo relativo.
  const base = pc > 0 ? pc : 0.01;
  const efeito = Math.max(Math.abs(dif), base * EFEITO_RELATIVO_MINIMO);
  const alvo = Math.min(0.999, base + efeito);
  out.amostra_necessaria = Math.max(AMOSTRA_MINIMA, amostraNecessaria(base, alvo));
  out.faltam = Math.max(0, out.amostra_necessaria - Math.min(ctrl.visitantes, v.visitantes));

  if (ctrl.visitantes > 0 && v.visitantes > 0) {
    const pool = (ctrl.leads + v.leads) / (ctrl.visitantes + v.visitantes);
    const se = Math.sqrt(pool * (1 - pool) * (1 / ctrl.visitantes + 1 / v.visitantes));
    if (se > 0) {
      out.p_valor = pValorBicaudal(dif / se);
    } else {
      // todos converteram ou ninguém converteu: sem evidência de diferença
      out.p_valor = dif === 0 ? 1 : 0;
    }
    out.confianca = 1 - out.p_valor;
  }

  if (out.p_valor === null || Math.min(ctrl.visitantes, v.visitantes) < AMOSTRA_MINIMA) {
    out.veredito = "cedo_demais";
  } else if (out.p_valor < 1 - CONFIANCA_MINIMA) {
    out.veredito = dif > 0 ? "vencedor" : "perdedor";
  } else {
    out.veredito = "sem_diferenca";
  }
  return out;
}

export function compararVariantes(variantes: VarianteEntrada[] | null | undefined): ResultadoComparacao {
  const lista: Normalizada[] = (variantes || []).map((v) => ({
    id: v.id,
    controle: !!v.controle,
    visitantes: Math.max(0, Number(v.visitantes) || 0),
    leads: Math.max(0, Math.min(Number(v.leads) || 0, Number(v.visitantes) || 0)),
  }));
  const ctrl = lista.find((v) => v.controle) || lista[0] || null;
  const avisos: string[] = [];

  const resultado: VarianteComparada[] = lista.map((v) => {
    const base = { ...v, taxa: taxaDe(v) };
    if (v === ctrl) {
      return {
        ...base,
        diferenca_abs: null,
        diferenca_rel: null,
        p_valor: null,
        confianca: null,
        amostra_necessaria: null,
        faltam: null,
        veredito: null,
      };
    }
    return { ...base, ...compararUma(ctrl as Normalizada, v) };
  });

  if (lista.length >= 3) {
    avisos.push(
      "Com 3 ou mais variantes, várias comparações aumentam o risco de falso positivo; confirme o vencedor antes de decidir.",
    );
  }
  if (lista.length < 2) avisos.push("É preciso ao menos 2 variantes para comparar.");

  const outras = resultado.filter((v) => v !== resultado[lista.indexOf(ctrl as Normalizada)]);
  const vencedores = outras.filter((v) => v.veredito === "vencedor").sort((a, b) => b.taxa - a.taxa);
  let veredito: VereditoGeral = "sem_diferenca";
  let vencedor_id: string | null = null;
  if (vencedores.length) {
    veredito = "vencedor";
    vencedor_id = vencedores[0].id;
  } else if (outras.length === 0 || outras.some((v) => v.veredito === "cedo_demais")) {
    veredito = "cedo_demais";
  }

  return {
    confianca_minima: CONFIANCA_MINIMA,
    amostra_minima: AMOSTRA_MINIMA,
    controle_id: ctrl ? ctrl.id : null,
    variantes: resultado,
    veredito,
    vencedor_id,
    avisos,
  };
}
