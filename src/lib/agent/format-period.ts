/**
 * Formatação de datas do agente para a tela. Compartilhado entre a barra de
 * contexto do drawer e o indicador de consulta — as duas superfícies mostram o
 * mesmo período e não podem divergir na grafia.
 */

/**
 * Formata `YYYY-MM-DD` como `DD/MM`. Devolve `null` para qualquer coisa que não
 * seja uma data no formato esperado — melhor não mostrar período nenhum do que
 * mostrar "undefined" ou "Invalid Date" para o usuário.
 *
 * Deliberadamente sem `new Date`: `new Date("2026-06-01")` é lido como UTC e,
 * em BRT (UTC-3), volta 31/05. A string já é a data que o usuário escolheu na
 * tela — basta reordenar os campos.
 */
export function formatDayMonth(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const [, , month, day] = match;
  return `${day}/${month}`;
}
