// Interpretação da resposta de POST /api/vendas/cycles/[id]/refresh e
// rótulo de "última atualização" (PRD issue #114, seção 3.6, RF-7, critério
// 8). Extraído para fora do componente do botão para ser testável sem DOM —
// a rota real (src/app/api/vendas/cycles/[id]/refresh/route.ts) devolve:
//   200 { upserted, lastRefreshAt }
//   429 { error, retryAfterSeconds }
//   409 { error }               (lock perdido OU ciclo encerrado)
//   5xx { error }

export type RefreshOutcome =
  | { kind: "success"; upserted: number; lastRefreshAt: string | null }
  | { kind: "throttled"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

function readString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" ? value : null;
}

function readNumber(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

export function interpretRefreshResponse(status: number, body: unknown): RefreshOutcome {
  const b = (body ?? {}) as Record<string, unknown>;

  if (status === 200) {
    return {
      kind: "success",
      upserted: readNumber(b, "upserted") ?? 0,
      lastRefreshAt: readString(b, "lastRefreshAt"),
    };
  }

  if (status === 429) {
    const seconds = readNumber(b, "retryAfterSeconds");
    return {
      kind: "throttled",
      message:
        seconds !== null
          ? `Atualização muito recente. Aguarde ${seconds}s e tente novamente.`
          : "Atualização muito recente. Aguarde um momento e tente novamente.",
    };
  }

  if (status === 409) {
    return {
      kind: "conflict",
      message: readString(b, "error") ?? "Atualização já em andamento.",
    };
  }

  return {
    kind: "error",
    message: readString(b, "error") ?? "Erro ao atualizar vendas.",
  };
}

// "Vendas atualizadas há X min" — null quando o timestamp não está
// disponível ou é inválido, para que o rótulo seja ocultado (nunca
// inventar um valor).
export function formatRefreshedAgo(isoTimestamp: string | null, now: Date = new Date()): string | null {
  if (!isoTimestamp) return null;
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return null;

  const diffMs = now.getTime() - then;
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes < 1) return "Vendas atualizadas agora";
  return `Vendas atualizadas há ${minutes} min`;
}
