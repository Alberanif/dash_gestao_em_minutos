// Agregação do cruzamento "compras do ciclo x base de inscritos do evento".
// Funções PURAS, sem React e sem Supabase — mesma disciplina de
// kpi-aggregation.ts e purchases-mode.ts. Roda no SERVIDOR (rota
// origin-breakdown): a base de inscritos tem nome e email de 724 pessoas e
// nunca é enviada ao browser; só os agregados desta função atravessam.

export interface OriginBreakdownRow {
  // Valor da dimensão (ex.: "Presencial") ou `null` para a linha "Não
  // encontrados" — compras cujo email não existe na base de inscritos.
  origin: string | null;
  purchases: number;
  // Total de inscritos com essa origem. `null` na linha de não encontrados: não
  // existe base para quem, por definição, não está na base.
  base: number | null;
  // 0–100. `null` na linha de não encontrados, pelo mesmo motivo de `base`.
  // Quem exibe formata — aqui não se arredonda para não perder resolução antes
  // da hora.
  conversion: number | null;
}

export interface OriginBreakdownBlock {
  key: string;
  title: string;
  rows: OriginBreakdownRow[];
}

// Linha da base de inscritos já reduzida a UMA dimensão pelo chamador.
export interface OriginBaseRow {
  email: string;
  origin: string | null;
}

// Rótulo para inscrito cuja dimensão está vazia no banco. Hoje não acontece
// (as duas colunas estão 100% preenchidas nas 724 linhas), mas silenciar essas
// pessoas encolheria a coluna "Base" sem deixar rastro — e a conversão de todo
// mundo subiria um pouco, sem ninguém notar.
export const SEM_INFORMACAO = "Sem informação";

// Mesma normalização do resto da feature (lower(btrim(...)) nas RPCs e nas
// rotas de exclusão), para que os dois lados do cruzamento se encontrem.
export function normalizeOriginEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeOriginValue(value: string | null): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? SEM_INFORMACAO : trimmed;
}

/**
 * Cruza os emails das COMPRAS do ciclo com a base de inscritos numa dimensão.
 *
 * `purchaseEmails` são os emails que a tela já está exibindo como compra
 * (categoria `renovado`) — por virem de lá, exclusões de lead, ofertas
 * excluídas, reembolsos e o recorte de datas já estão aplicados, e a soma da
 * coluna "Compras" fecha com o tile "Compras" do topo do dashboard.
 *
 * Os emails são DEDUPLICADOS. O roster já entrega um por pessoa, então na
 * prática isso é no-op; se algum dia entregar repetido, um bucket inflaria sem
 * o KPI inflar junto, e a tabela passaria a contradizer o topo em silêncio.
 */
export function aggregateOriginDimension(
  purchaseEmails: string[],
  baseRows: OriginBaseRow[]
): OriginBreakdownRow[] {
  // Toda origem presente na base vira bucket, mesmo sem nenhuma compra: uma
  // origem que não converteu é informação, e sumir com a linha esconderia que
  // ela existe.
  const baseCount = new Map<string, number>();
  const originByEmail = new Map<string, string>();

  for (const row of baseRows) {
    const email = normalizeOriginEmail(row.email);
    if (email === "") continue;
    const origin = normalizeOriginValue(row.origin);
    baseCount.set(origin, (baseCount.get(origin) ?? 0) + 1);
    // Primeira ocorrência vence. A base real não tem email repetido (724
    // distintos em 724 linhas); se tivesse, contar a mesma compra em dois
    // buckets estouraria o total.
    if (!originByEmail.has(email)) originByEmail.set(email, origin);
  }

  const purchaseCount = new Map<string, number>();
  let notFound = 0;

  for (const email of new Set(purchaseEmails.map(normalizeOriginEmail))) {
    if (email === "") continue;
    const origin = originByEmail.get(email);
    if (origin === undefined) {
      notFound += 1;
      continue;
    }
    purchaseCount.set(origin, (purchaseCount.get(origin) ?? 0) + 1);
  }

  const rows: OriginBreakdownRow[] = [...baseCount.entries()].map(([origin, base]) => {
    const purchases = purchaseCount.get(origin) ?? 0;
    return {
      origin,
      purchases,
      base,
      // base > 0 sempre: a origem só existe aqui porque veio de uma linha da
      // base. A guarda é contra regressão futura, não contra o dado de hoje.
      conversion: base > 0 ? (purchases / base) * 100 : 0,
    };
  });

  // Conversão desc — a origem que mais converte no topo responde "de onde vem a
  // venda" de bate-pronto. Desempate por base desc e depois por rótulo, para a
  // ordem ser determinística e as linhas não dançarem entre dois refreshes com
  // os mesmos números.
  rows.sort((a, b) => {
    const byConversion = (b.conversion ?? 0) - (a.conversion ?? 0);
    if (byConversion !== 0) return byConversion;
    const byBase = (b.base ?? 0) - (a.base ?? 0);
    if (byBase !== 0) return byBase;
    return (a.origin ?? "").localeCompare(b.origin ?? "", "pt-BR");
  });

  // Fora da ordenação e sempre por último: é o resíduo do cruzamento, não uma
  // origem que compete com as outras. Só aparece quando existe — uma linha de
  // zero aqui só ocuparia espaço.
  if (notFound > 0) {
    rows.push({ origin: null, purchases: notFound, base: null, conversion: null });
  }

  return rows;
}
