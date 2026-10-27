/**
 * Lógica pura da coleta em lote: configuração por plataforma, divisão em chunks mensais e a execução
 * (uma chamada ou uma por mês, com pausa entre elas). Sem React, para ser testada direto.
 */

export type PlataformaDados = "youtube" | "instagram" | "hotmart" | "meta-ads";

export const PLATAFORMAS: PlataformaDados[] = ["youtube", "instagram", "hotmart", "meta-ads"];

export const ROTULO_PLATAFORMA: Record<PlataformaDados, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  hotmart: "Hotmart",
  "meta-ads": "Meta Ads",
};

export type ConfigLote = {
  /** Rota de API chamada com { account_id, start_date, end_date }. */
  endpoint: string;
  titulo: string;
  descricao: string;
  /** Campos numéricos lidos da resposta; em lotes mensais são somados entre os chunks. */
  campos: string[];
  /** Divide o intervalo em meses, com pausa entre as chamadas. */
  mensal: boolean;
  /** Frase do selo de sucesso; recebe os totais por campo e a quantidade de lotes. */
  resumo: (totais: Record<string, number>, lotes: number) => string;
};

const fmt = (n: number) => n.toLocaleString("pt-BR");

export const CONFIG_LOTE: Record<PlataformaDados, ConfigLote> = {
  youtube: {
    endpoint: "/api/youtube/batch-collect",
    titulo: "Coleta em lote do YouTube",
    descricao: "Coleta as métricas diárias do canal em um intervalo e monta o histórico de dados.",
    campos: ["channelRecords", "videoRecords"],
    mensal: false,
    resumo: (t) => `${t.channelRecords} dias coletados + ${t.videoRecords} vídeos atualizados`,
  },
  instagram: {
    endpoint: "/api/instagram/batch-collect",
    titulo: "Coleta em lote do Instagram",
    descricao: "Coleta as métricas diárias de insights em um intervalo.",
    campos: ["profileRecords", "mediaRecords"],
    mensal: false,
    resumo: (t) => `${t.profileRecords} dias de insights + ${t.mediaRecords} mídias coletados`,
  },
  hotmart: {
    endpoint: "/api/hotmart/batch-collect",
    titulo: "Coleta em lote da Hotmart",
    descricao:
      "Divide o intervalo em meses, coleta um mês por vez e atualiza o histórico ao terminar. Para no primeiro erro.",
    campos: ["salesRecords"],
    mensal: true,
    resumo: (t, lotes) => `${fmt(t.salesRecords)} registros coletados em ${lotes} lotes`,
  },
  "meta-ads": {
    endpoint: "/api/meta-ads/batch-collect",
    titulo: "Coleta em lote do Meta Ads",
    descricao: "Coleta as métricas diárias e os snapshots de campanhas em um intervalo.",
    campos: ["dailyRecords", "campaignDailyRecords"],
    mensal: false,
    resumo: (t) => `${t.dailyRecords} dias + ${t.campaignDailyRecords} registros de campanha coletados`,
  },
};

export const PAUSA_ENTRE_CHUNKS_MS = 1500;
export const ERRO_REDE = "Falha na comunicação com o servidor";
export const ERRO_DESCONHECIDO = "Erro desconhecido";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function paraUtc(iso: string): number | null {
  const m = ISO.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const paraIso = (utc: number) => new Date(utc).toISOString().slice(0, 10);

/**
 * Divide [inicio, fim] (YYYY-MM-DD, inclusivos) em um chunk por mês: o primeiro começa na data inicial,
 * os seguintes no dia 1, e o último termina na data final (mês parcial). Aritmética em UTC, então o
 * resultado não depende do fuso nem do horário de verão do navegador.
 */
export function dividirEmMeses(inicio: string, fim: string): Array<{ start: string; end: string }> {
  const ini = paraUtc(inicio);
  const fin = paraUtc(fim);
  if (ini === null || fin === null) return [];
  const chunks: Array<{ start: string; end: string }> = [];
  let atual = ini;
  while (atual <= fin) {
    const d = new Date(atual);
    const ultimoDoMes = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
    chunks.push({ start: paraIso(atual), end: ultimoDoMes <= fin ? paraIso(ultimoDoMes) : fim });
    atual = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return chunks;
}

export type StatusChunk = "pending" | "loading" | "success" | "error";
export type StatusLote = "idle" | "loading" | "success" | "error";

export type Chunk = { start: string; end: string; status: StatusChunk; records?: number; error?: string };

export type EstadoLote = {
  status: StatusLote;
  /** Só nos lotes mensais; null quando a coleta é uma chamada única. */
  chunks: Chunk[] | null;
  /** Registros acumulados (primeiro campo da configuração). */
  acumulado: number;
  /** Mensagem do selo de sucesso. */
  resultado: string | null;
  erro: string | null;
};

export const LOTE_OCIOSO: EstadoLote = { status: "idle", chunks: null, acumulado: 0, resultado: null, erro: null };

type Resposta = { ok: true; json: Record<string, unknown> } | { ok: false; erro: string; rede: boolean };

async function postar(fetcher: typeof fetch, endpoint: string, corpo: unknown): Promise<Resposta> {
  try {
    const res = await fetcher(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) return { ok: false, erro: typeof json.error === "string" ? json.error : "", rede: false };
    return { ok: true, json };
  } catch {
    return { ok: false, erro: ERRO_REDE, rede: true };
  }
}

/** Faz um POST { account_id } e devolve o JSON ou a mensagem de erro (usado pelo catálogo da Hotmart). */
export async function executarAcaoDaConta(
  endpoint: string,
  contaId: string,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; erro: string }> {
  const r = await postar(fetcher, endpoint, { account_id: contaId });
  if (r.ok) return r;
  return { ok: false, erro: r.erro || ERRO_DESCONHECIDO };
}

type Entrada = {
  config: ConfigLote;
  contaId: string;
  inicio: string;
  fim: string;
  /** Chamado a cada mudança de estado, com um objeto novo. */
  aoMudar: (estado: EstadoLote) => void;
  fetcher?: typeof fetch;
  pausaMs?: number;
  esperar?: (ms: number) => Promise<void>;
};

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const numero = (v: unknown) => (typeof v === "number" ? v : 0);

/**
 * Executa a coleta. Em plataformas mensais manda um POST por mês, em ordem, com pausa entre eles, e para
 * no primeiro erro. Devolve o estado final (sucesso ou erro).
 */
export async function executarLote({
  config,
  contaId,
  inicio,
  fim,
  aoMudar,
  fetcher = fetch,
  pausaMs = PAUSA_ENTRE_CHUNKS_MS,
  esperar = dormir,
}: Entrada): Promise<EstadoLote> {
  const periodos = config.mensal ? dividirEmMeses(inicio, fim) : [{ start: inicio, end: fim }];
  let chunks: Chunk[] | null = config.mensal ? periodos.map((p) => ({ ...p, status: "pending" as const })) : null;
  const totais: Record<string, number> = Object.fromEntries(config.campos.map((c) => [c, 0]));
  let estado: EstadoLote = { ...LOTE_OCIOSO, status: "loading", chunks };
  const emitir = (parcial: Partial<EstadoLote>) => {
    estado = { ...estado, ...parcial };
    aoMudar(estado);
  };
  const marcar = (i: number, parcial: Partial<Chunk>) => {
    if (!chunks) return;
    chunks = chunks.map((c, idx) => (idx === i ? { ...c, ...parcial } : c));
    emitir({ chunks });
  };
  aoMudar(estado);

  for (let i = 0; i < periodos.length; i++) {
    marcar(i, { status: "loading" });
    const r = await postar(fetcher, config.endpoint, {
      account_id: contaId,
      start_date: periodos[i].start,
      end_date: periodos[i].end,
    });

    if (!r.ok) {
      const msg = r.erro || ERRO_DESCONHECIDO;
      if (config.mensal) {
        marcar(i, { status: "error", error: r.rede ? "Falha de rede" : r.erro || "Erro" });
        emitir({
          status: "error",
          erro: r.rede ? ERRO_REDE : `Falha no chunk ${periodos[i].start}→${periodos[i].end}: ${msg}`,
        });
      } else {
        emitir({ status: "error", erro: msg });
      }
      return estado;
    }

    for (const campo of config.campos) totais[campo] += numero(r.json[campo]);
    emitir({ acumulado: totais[config.campos[0]] });
    marcar(i, { status: "success", records: numero(r.json[config.campos[0]]) });

    if (i < periodos.length - 1) await esperar(pausaMs);
  }

  emitir({ status: "success", resultado: config.resumo(totais, periodos.length) });
  return estado;
}
