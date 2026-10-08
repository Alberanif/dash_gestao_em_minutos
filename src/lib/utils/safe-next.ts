/**
 * Valida o parâmetro `next` do login. Só aceita caminho interno ("/..."),
 * para evitar open redirect; qualquer outra coisa vira "/".
 */
export function sanitizeNext(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "/";
  if (!raw.startsWith("/")) return "/";
  // "//host" e "/\host" são tratados como URL de outro host pelos navegadores.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  // Tab/quebra de linha/controle são removidos pelo parser de URL ("/\t/x" vira "//x").
  if (/[\u0000-\u001f\u007f]/.test(raw)) return "/";
  return raw;
}
