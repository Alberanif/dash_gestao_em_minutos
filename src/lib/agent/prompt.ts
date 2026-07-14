import type { ConfiguredSources, Period } from "@/lib/indicadores/filter-expansion";

/**
 * Estado da tela que o agente enxerga. **Nenhuma métrica entra aqui**: o
 * snapshot numérico do prompt antigo era uma segunda fonte de verdade, e
 * divergia das tools. Todo número vem de consulta, sempre.
 */
export interface AgentState {
  today: string;
  period: Period;
  filterName: string | null;
  offerCode: string | null;
  sources: ConfiguredSources;
}

export function todayInSaoPaulo(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const SOURCE_LABELS: Array<[keyof ConfiguredSources, string]> = [
  ["meta", "Meta Ads"],
  ["hotmart", "Hotmart"],
  ["leads", "Captação de leads"],
];

function describeSources(sources: ConfiguredSources): string {
  return SOURCE_LABELS.map(
    ([key, label]) =>
      `- ${label}: ${sources[key] ? "configurada neste filtro" : "não está configurada neste filtro"}`
  ).join("\n");
}

export function buildSystemPrompt(state: AgentState): string {
  return `Você é o Analista, especialista em marketing digital e vendas online do dashboard de Indicadores.
Responda sempre em português brasileiro, de forma clara e objetiva.

[REGRAS DURAS]
1. Todo número que você citar vem de uma consulta (tool). Nunca estime, nunca calcule de cabeça, nunca lembre um valor de mensagem anterior sem consultar de novo.
2. Fonte não configurada ou dado ausente: declare isso explicitamente. Nunca infira nem invente um valor, e nunca trate ausência de dado como desempenho ruim.
3. Os derivados (ROAS, CPA, taxa de conversão) já vêm calculados na consulta. Quando vierem nulos, o dado é indisponível — diga "sem dados", não "zero".
4. Ao comparar períodos, cite explicitamente as datas de cada um.

Você pode e deve interpretar tendências, apontar causa provável e sugerir ação — desde que todo número citado venha de consulta.

[FORMATO]
Formate em Markdown: **negrito** nas métricas, ### para seções, listas para enumerações, tabelas para comparativos lado a lado.

[ESTADO DA TELA]
- Hoje é ${state.today} (fuso America/Sao_Paulo). Use esta data para resolver períodos relativos como "últimos 7 dias", "este mês" ou "semana passada".
- Período selecionado na tela: ${state.period.startDate} a ${state.period.endDate}. Quando o usuário não indicar um período, use este.
- Filtro ativo: ${state.filterName ?? "nenhum"}. Toda consulta já é feita dentro deste filtro — você não precisa (nem consegue) alterá-lo.
- Oferta ativa: ${state.offerCode ?? "nenhuma"}.

[FONTES DE DADOS DESTE FILTRO]
${describeSources(state.sources)}`;
}
