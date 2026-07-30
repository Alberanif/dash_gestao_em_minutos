// Acúmulo no cliente das contagens da RPC (PRD issue #114, seção 3.3) —
// GET /api/ultimates/cycles/[id]/{daily,hourly} devolvem valores por bucket,
// não acumulados; o gráfico precisa da soma corrente.
import type { UltimatesDailyRow, UltimatesHourlyRow } from "@/types/ultimates";

// Séries alternáveis pelo switch do card "Evolução".
export type UltimatesSeries = "renovacoes" | "novos";

// Granularidade do eixo temporal do mesmo card.
export type UltimatesGranularity = "dia" | "hora";

// `key` é a chave temporal do bucket, no formato em que a RPC a devolveu:
// "YYYY-MM-DD" na visão dia, "YYYY-MM-DDTHH" na visão hora. Quem desenha
// formata para exibição (fmtDateShort / fmtHourShort) — aqui ela fica crua,
// e nenhuma camada a converte para Date.
export interface CumulativePoint {
  key: string;
  cumulative: number;
}

// Uma série por chamada, sobre o MESMO conjunto de dias: a RPC (migration 051)
// agrega as duas contagens juntas, então dias em que a série pedida não teve
// nada continuam presentes como patamar plano. É isso que faz os dois
// gráficos serem comparáveis ponto a ponto ao alternar o switch.
export function buildCumulativeSeries(
  days: UltimatesDailyRow[],
  series: UltimatesSeries = "renovacoes"
): CumulativePoint[] {
  // Defensivo: ordena por dia (string ISO YYYY-MM-DD, ordem lexicográfica ==
  // ordem cronológica) antes de acumular, caso a RPC não garanta ordem.
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));

  let running = 0;
  return sorted.map((d) => {
    running += (series === "novos" ? d.new_buyers : d.renewals) ?? 0;
    return { key: d.day, cumulative: running };
  });
}

const HORA_MS = 3_600_000;

// "2026-07-30T14" -> epoch ms, tratando a string como se fosse UTC.
//
// Ela NÃO é UTC — é hora de parede em America/Sao_Paulo, já convertida pela
// RPC (migration 054). Fingir que é UTC é justamente o que torna a aritmética
// correta: some uma hora e a próxima chave sai certa, sem que o fuso da
// máquina que renderiza, ou um horário de verão de qualquer lugar do mundo,
// tenha voz no resultado. A ida e a volta usam sempre os getters UTC, então a
// mentira se cancela.
function horaParaMs(key: string): number {
  const [datePart, hourPart] = key.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  return Date.UTC(y, m - 1, d, Number(hourPart));
}

function msParaHora(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}`;
}

// Teto de horas que o preenchimento tem permissão de materializar. O ciclo
// (dash_gestao_ultimates_cycles) não tem colunas de início/fim, e a RPC
// (migration 054) filtra só por produto + status — ela devolve toda hora com
// venda no histórico INTEIRO do produto, não só do ciclo corrente. Um produto
// com dois anos de vendas já gera ~17.500h de vão; uma única approved_date
// corrompida (ano 2999, por exemplo) gera um vão de milhões de horas e trava
// a aba preenchendo o array. 2000h (~83 dias) cobre qualquer ciclo real com
// folga generosa sem abrir essa porta.
const TETO_HORAS_PREENCHIDAS = 2000;

// Acumula os pontos recebidos, sem preencher as horas entre eles — o mesmo
// contrato da curva diária. É o fallback usado quando preencher não é seguro
// (vão maior que o teto, ou uma chave `hour` malformada): devolver os dados
// crus e honestos é sempre melhor do que travar a aba ou devolver [] e
// esconder uma série que era válida.
function semPreencher(contagens: Map<string, number>): CumulativePoint[] {
  const pontos: CumulativePoint[] = [];
  let running = 0;
  for (const [key, valor] of contagens) {
    running += valor;
    pontos.push({ key, cumulative: running });
  }
  return pontos;
}

// Mesma curva acumulada, com bucket de hora. Diferente da versão diária, esta
// PREENCHE as horas sem venda entre a primeira e a última recebidas: o eixo do
// Recharts é categórico, então uma hora ausente não vira platô — ela some, e a
// inclinação passaria a mentir sobre o ritmo (uma madrugada parada ficaria com
// a mesma largura de uma hora cheia). A RPC devolve só horas com venda
// justamente porque a expansão é barata aqui e cara no payload.
export function buildHourlyCumulativeSeries(
  hours: UltimatesHourlyRow[],
  series: UltimatesSeries = "renovacoes"
): CumulativePoint[] {
  if (hours.length === 0) return [];

  const sorted = [...hours].sort((a, b) => a.hour.localeCompare(b.hour));

  // Soma em vez de sobrescrever: a RPC agrupa por hora, então duplicata não
  // deveria existir — mas somar é a única resposta que não perde uma venda.
  // `Number.isFinite`, não `?? 0`: a rota passa a contagem por Number(...)
  // antes de chegar aqui, então um valor não-numérico vira NaN, não
  // null/undefined — e `??` não intercepta NaN. Um único NaN acumulado apaga
  // o eixo Y inteiro no Recharts.
  const contagens = new Map<string, number>();
  for (const h of sorted) {
    const bruto = series === "novos" ? h.new_buyers : h.renewals;
    const valor = Number.isFinite(bruto) ? bruto : 0;
    contagens.set(h.hour, (contagens.get(h.hour) ?? 0) + valor);
  }

  const inicio = horaParaMs(sorted[0].hour);
  const fim = horaParaMs(sorted[sorted.length - 1].hour);

  // `fim` (ou `inicio`) pode vir NaN se a chave `hour` de alguma ponta for
  // malformada — só as duas pontas são parseadas, o meio nunca é validado.
  // Sem essa guarda, a primeira comparação do loop abaixo já seria falsa e a
  // função devolveria [], jogando fora uma série cujos dados eram válidos.
  //
  // O tamanho do vão é calculado ANTES de qualquer alocação: comparamos o
  // número de horas que o loop emitiria contra o teto antes de criar o array
  // que o preenchimento produziria.
  const vaoHoras = Math.round((fim - inicio) / HORA_MS) + 1;
  const vaoValido = Number.isFinite(inicio) && Number.isFinite(fim);

  if (!vaoValido || vaoHoras > TETO_HORAS_PREENCHIDAS) {
    return semPreencher(contagens);
  }

  const pontos: CumulativePoint[] = [];
  let running = 0;
  for (let ms = inicio; ms <= fim; ms += HORA_MS) {
    const key = msParaHora(ms);
    running += contagens.get(key) ?? 0;
    pontos.push({ key, cumulative: running });
  }
  return pontos;
}
