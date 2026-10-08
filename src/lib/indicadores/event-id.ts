const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O `id` de um Evento (dash_gestao_filters) é um UUID. Um ID vindo da URL que
 * não passa aqui é tratado como inexistente, sem consultar o banco.
 */
export function isEventId(value: string): boolean {
  return UUID_RE.test(value);
}
