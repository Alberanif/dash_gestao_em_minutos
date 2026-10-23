import type { Transition, Variants } from "motion/react";

/** Mesmas curvas dos tokens --v2-ease-saida e --v2-ease-suave. */
export const easeSaida = [0.16, 1, 0.3, 1] as const;
export const easeSuave = [0.4, 0, 0.2, 1] as const;

/** Durações em segundos, iguais aos tokens --v2-dur-*. */
export const dur = { rapida: 0.12, media: 0.24, lenta: 0.48 } as const;

/** Desenho dos gráficos e contagem dos números, em segundos. Espelham os tokens --v2-dur-* e --v2-ease-desenho. */
export const durDesenho = { traco: 1.2, contagem: 1.4, filtro: 0.38 } as const;
export const easeDesenho = [0.22, 1, 0.36, 1] as const;

export const transicaoPadrao: Transition = { duration: dur.media, ease: easeSaida };

/** Só opacity e transform (y), nunca propriedades de layout ou cor. */
export const fadeRise: Variants = {
  oculto: { opacity: 0, y: 8 },
  visivel: { opacity: 1, y: 0, transition: transicaoPadrao },
  saindo: { opacity: 0, y: -8, transition: { duration: dur.rapida, ease: easeSuave } },
};

export const fade: Variants = {
  oculto: { opacity: 0 },
  visivel: { opacity: 1, transition: transicaoPadrao },
  saindo: { opacity: 0, transition: { duration: dur.rapida, ease: easeSuave } },
};

/** Variante instantânea usada quando prefers-reduced-motion está ativo. */
export const instantaneo: Variants = {
  oculto: { opacity: 1, y: 0 },
  visivel: { opacity: 1, y: 0, transition: { duration: 0 } },
  saindo: { opacity: 1, y: 0, transition: { duration: 0 } },
};
