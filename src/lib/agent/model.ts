/**
 * Modelo do Analista. Trocável por ambiente (AGENT_MODEL) para permitir A/B
 * sem deploy. gpt-4o-mini foi abandonado: erra aritmética de comparativos e
 * não respeita o formato Markdown pedido no prompt.
 */
export const DEFAULT_AGENT_MODEL = "gpt-4.1";

export function resolveAgentModel(env: Record<string, string | undefined>): string {
  const configured = env.AGENT_MODEL?.trim();
  return configured ? configured : DEFAULT_AGENT_MODEL;
}
