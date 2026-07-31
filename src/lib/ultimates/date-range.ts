// Intervalo de datas do dash Ultimates: validação, persistência e o predicado
// de recorte do gráfico. Tudo que dá para decidir sem React mora aqui — o
// componente da barra só cuida do formulário.
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

const STORAGE_KEY = "ultimates-date-range";

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

// Lê o intervalo salvo. APAGA a chave quando ela não sobrevive à validação —
// efeito colateral deliberado num getter: sem ele, uma chave corrompida (por
// mão humana no DevTools ou por uma versão futura que mude o payload) ficaria
// para sempre no navegador, sendo relida e descartada a cada montagem.
export function readStoredRange(): DateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    const start = (parsed as { start?: unknown } | null)?.start;
    const end = (parsed as { end?: unknown } | null)?.end;
    const range =
      typeof start === "string" && typeof end === "string"
        ? parseDateRange(start, end)
        : null;
    if (range === null) clearStoredRange();
    return range;
  } catch {
    clearStoredRange();
    return null;
  }
}

export function writeStoredRange(range: DateRange): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
  } catch {
    // localStorage pode estar cheio ou bloqueado (modo privado, política de
    // cookies). Perder a persistência é aceitável; quebrar a aba não é.
  }
}

export function clearStoredRange(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Mesmo motivo do writeStoredRange.
  }
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
