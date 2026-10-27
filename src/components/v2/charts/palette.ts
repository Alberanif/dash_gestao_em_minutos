/** Cores dos gráficos, sempre por token (nada de hex solto). Valores e validação: tokens.css. */

export const NUM_SERIES = 5;

/** Série `i` (0 a 4), em ordem fixa. Depois da quinta, a cor é a ardósia ("Outros"), nunca um tom novo. */
export const corSerie = (i: number): string => (i < NUM_SERIES ? `var(--v2-serie-${i + 1})` : "var(--v2-ardosia)");

/** Passo `p` (1 a 5) da rampa ordinal do funil. */
export const corFunil = (p: number): string => `var(--v2-funil-${Math.min(5, Math.max(1, p))})`;

export const COR = {
  superficie: "var(--v2-casco)",
  /** O latão é só o último ponto de cada linha. Nenhum outro elemento usa. */
  ponto: "var(--v2-ponto)",
  brilhoPonto: "drop-shadow(0 0 4px rgb(217 164 65 / 0.55))",
  grade: "var(--v2-grade)",
  eixo: "var(--v2-eixo)",
  textoMudo: "var(--v2-texto-mudo)",
  texto: "var(--v2-nevoa)",
  cursor: "rgb(111 184 227 / 0.45)",
  outros: "var(--v2-ardosia)",
} as const;

/** Acima deste número de pontos o brilho (filtro de pintura) é desligado para manter 60 fps. */
export const LIMITE_BRILHO_PONTOS = 1500;
