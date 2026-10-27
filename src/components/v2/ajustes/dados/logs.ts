export type LogColeta = {
  id: string;
  status: "success" | "error";
  account_name: string | null;
  started_at: string;
  finished_at: string | null;
  duration_s: number | null;
  records_collected: number | null;
  error_message: string | null;
};

export type ContaPlataforma = { id: string; name: string };

/** O log mais recente por início, independentemente da ordem em que a API devolveu. */
export function logMaisRecente(logs: LogColeta[]): LogColeta | null {
  let melhor: LogColeta | null = null;
  for (const l of logs) {
    if (!melhor || new Date(l.started_at).getTime() > new Date(melhor.started_at).getTime()) melhor = l;
  }
  return melhor;
}

/** "há 5 min", "há 2 h", "há 3 d". Datas inválidas ou no futuro viram "agora há pouco". */
export function tempoRelativo(iso: string, agora: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "em data desconhecida";
  const min = Math.floor((agora - t) / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}
