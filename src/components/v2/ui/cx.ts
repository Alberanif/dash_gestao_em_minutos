/** Junta classes ignorando valores falsos. */
export function cx(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(" ");
}

/** Foco visível por teclado, igual em todos os primitivos. */
export const foco =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-azul-luz";
