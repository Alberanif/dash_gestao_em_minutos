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

  // `Number.isFinite`, não `?? 0` — mesma guarda da série horária, palavra por
  // palavra, porque é o mesmo modo de falha: daily/route.ts passa a contagem
  // por Number(...), então um valor não-numérico chega aqui como NaN, não como
  // null/undefined, e `??` não intercepta NaN. Um único NaN acumulado apaga o
  // eixo Y inteiro no Recharts — e as duas curvas dividem o mesmo card.
  let running = 0;
  return sorted.map((d) => {
    const bruto = series === "novos" ? d.new_buyers : d.renewals;
    running += Number.isFinite(bruto) ? bruto : 0;
    return { key: d.day, cumulative: running };
  });
}

const HORA_MS = 3_600_000;

// "2026-07-30T14" -> epoch ms, tratando a string como se fosse UTC.
//
// Ela NÃO é UTC — é hora de parede em America/Sao_Paulo, já convertida pela
// RPC (migration 054). Fingir que é UTC é justamente o que torna a aritmética
// correta: some uma hora e a próxima chave sai certa, sem que o fuso da
// máquina que renderiza — nem um horário de verão VIGENTE NESSE fuso — tenha
// voz no resultado. A ida e a volta usam sempre os getters UTC, então a
// mentira se cancela. (Isso não diz nada sobre o horário de verão do fuso do
// DADO: se o Brasil voltar a ter DST, quem resolve isso é o `at time zone` da
// RPC, não esta aritmética.)
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
// venda no histórico INTEIRO do produto, não só do ciclo corrente. O spec
// (Risco #1) estima um ciclo de 6 meses em ~4300 pontos horários e já diz que
// "fica pesado" — pesado, não impossível, e o teto não é o lugar de recusá-lo,
// então ele precisa folgar acima disso: 8760h (1 ano) cobre os 6 meses e
// ainda rejeita os casos realmente patológicos — produto com dois anos de
// vendas (~17.500h de vão) e approved_date corrompida (ano 2999, por
// exemplo, gerando um vão de milhões de horas que travaria a aba).
const TETO_HORAS_PREENCHIDAS = 8760;

// Acumula os pontos recebidos, sem preencher as horas entre eles — o mesmo
// contrato da curva diária. É o fallback usado quando preencher não é seguro
// (vão maior que o teto, chave `hour` malformada, ou formato que não sobrevive
// ao round-trip): devolver os dados crus e honestos é sempre melhor do que
// travar a aba ou devolver [] e esconder uma série que era válida.
//
// A saída sai na ordem de INSERÇÃO do Map, que é a ordem lexicográfica do
// `sorted` de quem chama — e não a cronológica quando a entrada é justamente a
// patológica do vão invertido ("T9" depois de "T10"). É aceito de propósito:
// reordenar exigiria confiar na mesma conversão que já se provou não confiável
// no caso que trouxe a série até aqui.
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

  // `vaoHoras < 1`: `sorted` está em ordem lexicográfica, não cronológica —
  // uma chave `hour` fora do formato pode fazer "o maior" ordenar antes de "o
  // menor" quando convertido para ms. O gatilho plausível é uma hora sem zero
  // à esquerda vinda de uma deriva do to_char ("T9" ordena depois de "T10",
  // mas é cronologicamente antes); um ano com 5 dígitos faria o mesmo. Nesse
  // caso `fim < inicio`, `vaoHoras` fica negativo (não é `> TETO`) e a
  // primeira comparação do loop (`ms <= fim`) já começaria falsa — mesmo
  // sintoma do finding do `hour` malformado, então cai no mesmo fallback.
  if (!vaoValido || vaoHoras < 1 || vaoHoras > TETO_HORAS_PREENCHIDAS) {
    return semPreencher(contagens);
  }

  // O preenchimento indexa por chave CRUA (`h.hour`, acima) e relê por chave
  // REGERADA (`msParaHora`, abaixo). As duas só coincidem enquanto o to_char da
  // migration 054 emitir exatamente "YYYY-MM-DDTHH". Se ele derivar, todo
  // lookup erra, o acumulado nunca sai de zero e a guarda de vazio do
  // CumulativeChart (último cumulative === 0) anuncia "Sem renovações
  // registradas no ciclo ainda." — uma falha de encanamento vestida de
  // resposta de negócio, o pior desfecho possível para um dashboard. Então a
  // premissa se verifica sozinha: se a volta não reproduz uma chave que
  // chegou de verdade, o preenchimento é abortado e os dados recebidos saem
  // inteiros pelo fallback.
  if (!contagens.has(msParaHora(inicio))) return semPreencher(contagens);

  const pontos: CumulativePoint[] = [];
  let running = 0;
  for (let ms = inicio; ms <= fim; ms += HORA_MS) {
    const key = msParaHora(ms);
    running += contagens.get(key) ?? 0;
    pontos.push({ key, cumulative: running });
  }
  return pontos;
}
