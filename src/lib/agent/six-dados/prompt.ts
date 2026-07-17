import type { AiReportKpiBlock } from "@/types/indicadores";

/**
 * Prompt dedicado do Six Dados: geração one-shot, sem tools, sem ReAct. Os
 * números já vêm prontos (dois blocos, vitalício e 7d) — o modelo só narra,
 * nunca calcula. Reaproveita as mesmas REGRAS DURAS de `src/lib/agent/prompt.ts`
 * (só números fornecidos, `null` = indisponível, pt-BR, timezone
 * America/Sao_Paulo), adaptadas para um parágrafo curto em vez de um chat.
 */
export interface BuildSixDadosPromptInput {
  eventoName: string;
  lifetime: AiReportKpiBlock;
  last7d: AiReportKpiBlock;
}

/** `null` é sempre "indisponível" no texto — nunca "0", que seria lido como desempenho ruim. */
function formatMetric(value: number | null): string {
  return value === null ? "indisponível" : String(value);
}

function formatBlock(label: string, block: AiReportKpiBlock): string {
  return `${label} (${block.startDate} a ${block.endDate}):
- ROAS: ${formatMetric(block.roas)}
- Receita (BRL): ${formatMetric(block.revenueBrl)}
- Leads: ${formatMetric(block.leads)}
- CPL: ${formatMetric(block.cpl)}
- Investimento (Meta Ads): ${formatMetric(block.spend)}
- Vendas: ${formatMetric(block.sales)}`;
}

export function buildSixDadosPrompt({
  eventoName,
  lifetime,
  last7d,
}: BuildSixDadosPromptInput): string {
  return `Você é o Analista, especialista em marketing digital e vendas online do dashboard de Indicadores.
Gere um resumo executivo em português brasileiro (pt-BR) sobre o Evento "${eventoName}", com base exclusivamente nos números abaixo.

[REGRAS DURAS]
1. Cite apenas os números fornecidos abaixo. Nunca estime, nunca calcule de cabeça, nunca invente um valor.
2. "indisponível" significa que a fonte não está configurada neste Evento ou o dado não existe — nunca trate como zero, e nunca trate ausência de dado como desempenho ruim.
3. Responda sempre em português brasileiro.
4. As datas dos períodos abaixo já estão resolvidas no fuso America/Sao_Paulo — não recalcule nem invente outras datas.

[NÚMEROS DO EVENTO]
${formatBlock("Acumulado (vitalício)", lifetime)}

${formatBlock("Últimos 7 dias", last7d)}

[FORMATO]
Escreva de 3 a 5 frases, em tom executivo, como texto corrido (no máximo **negrito** para destacar métricas — sem listas, sem títulos, sem tabelas). Destaque o resultado acumulado e a tendência dos últimos 7 dias (aceleração ou queda). Cite apenas os números fornecidos acima.`;
}
