// Intervalo de datas do dash Ultimates: validação, leitura do que veio do banco
// e o predicado de recorte do gráfico. Tudo que dá para decidir sem React mora
// aqui — o componente da barra só cuida do formulário.
//
// NÃO HÁ MAIS PERSISTÊNCIA NO NAVEGADOR (migration 063). O intervalo era estado
// de quem olhava, guardado em localStorage sob uma chave global; agora é
// propriedade do ciclo, guardada em cycles.view_start_date/view_end_date e
// aplicada igualmente a todo mundo. Quem escreve é o PATCH do ciclo, não este
// módulo — se você procura readStoredRange/writeStoredRange, elas foram
// removidas, não movidas.
//
// As datas são STRINGS "YYYY-MM-DD" do começo ao fim, nunca Date. Esse formato
// é o mesmo do <input type="date">, o mesmo das chaves de bucket que a RPC
// devolve e o mesmo que a API repassa ao Postgres. Construir um Date no meio
// do caminho reinterpretaria a data no fuso de quem renderiza e faria a
// fronteira do intervalo escorregar um dia — exatamente o que o resto do dash
// evita ao extrair componentes UTC em format.ts.

export interface DateRange {
  // Sempre <= end. Quem monta um DateRange passa por parseDateRange.
  start: string;
  end: string;
}

// Estrito de propósito: "2026-7-10" ordena errado numa comparação de string
// ("2026-7-10" > "2026-07-20"), e a comparação de string é justamente o
// mecanismo de keyInRange. Aceitar o formato frouxo daria recorte
// silenciosamente errado em vez de intervalo recusado.
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Única porta de entrada de um DateRange. Devolve null para QUALQUER entrada
// que não seja um intervalo completo e ordenado — nunca meio intervalo, nunca
// exceção: os dois chamadores (formulário e localStorage) tratam "não deu" da
// mesma forma, mostrando o dash do ciclo inteiro.
export function parseDateRange(start: string, end: string): DateRange | null {
  if (!ISO_DAY.test(start) || !ISO_DAY.test(end)) return null;
  if (end < start) return null;
  return { start, end };
}

// Lê a janela que veio do ciclo (cycles.view_start_date/view_end_date). Aceita
// `unknown` porque isto é a fronteira com o banco: a resposta do PostgREST não
// é validada em lugar nenhum, e sem a migration 063 aplicada as duas chaves nem
// existem no objeto.
//
// TUDO que não for um par completo e ordenado de "YYYY-MM-DD" vira `null` = sem
// janela = ciclo inteiro. Isso inclui o caso que o CHECK do banco deveria tornar
// impossível (uma ponta só): a constraint protege escritas futuras, mas um
// UPDATE manual no painel do Supabase pode ter precedido a 063, e degradar para
// "sem janela" é o único desfecho que não inventa uma fronteira.
export function viewRangeFrom(start: unknown, end: unknown): DateRange | null {
  if (typeof start !== "string" || typeof end !== "string") return null;
  return parseDateRange(start, end);
}

// Recorte do gráfico. `key` é "YYYY-MM-DD" (bucket de dia) ou "YYYY-MM-DDTHH"
// (bucket de hora); só os 10 primeiros caracteres participam, então a mesma
// função serve às duas granularidades. Comparação de string funciona porque o
// formato ISO tem ordem lexicográfica == ordem cronológica — a mesma premissa
// que buildCumulativeSeries já usa para ordenar.
//
// Sem intervalo, TUDO passa: `null` é "ciclo inteiro", não "nada".
export function keyInRange(key: string, range: DateRange | null): boolean {
  if (range === null) return true;
  const day = key.slice(0, 10);
  return day >= range.start && day <= range.end;
}
