"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatAge } from "@/lib/indicadores/cron-freshness";
import type { RefreshAccountError, RefreshStatus } from "@/lib/indicadores/refresh-status";
import { cx, foco } from "../ui/cx";

export const ATUALIZAR_POLL_MS = 5000;

const STATUS_URL = "/api/indicadores/refresh-status";
const REFRESH_URL = "/api/indicadores/refresh";

const PLATAFORMA: Record<string, string> = {
  hotmart: "Hotmart",
  "meta-ads": "Meta Ads",
};

type Fase = "ocioso" | "atualizando";

/**
 * "Atualizar Agora" do evento: dispara a coleta de Hotmart e Meta Ads, acompanha até o fim
 * e então refaz os blocos do servidor (router.refresh) e os do cliente (invalidateQueries).
 * Mesmas rotas e regras do botão do V1; o período escolhido fica intacto.
 */
export function AtualizarAgora({ agora }: { /** Relógio injetável (testes). */ agora?: () => Date }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RefreshStatus | null>(null);
  const [fase, setFase] = useState<Fase>("ocioso");
  const [outraRodada, setOutraRodada] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erros, setErros] = useState<RefreshAccountError[]>([]);
  // Sem isto, um 2º clique antes do 1º POST responder dispararia duas coletas.
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);

  const aoTerminar = useCallback(() => {
    router.refresh();
    void queryClient.invalidateQueries();
  }, [router, queryClient]);
  const aoTerminarRef = useRef(aoTerminar);
  useEffect(() => {
    aoTerminarRef.current = aoTerminar;
  }, [aoTerminar]);

  const lerStatus = useCallback(async (): Promise<RefreshStatus | null> => {
    try {
      const res = await fetch(STATUS_URL);
      if (!res.ok) return null;
      return (await res.json()) as RefreshStatus;
    } catch {
      return null;
    }
  }, []);

  // Leitura inicial: coleta já em andamento (cron, outra aba ou usuário) é acompanhada.
  useEffect(() => {
    let cancelado = false;
    lerStatus().then((s) => {
      if (cancelado || !s) return;
      setStatus(s);
      if (s.running) {
        setOutraRodada(true);
        setFase("atualizando");
      }
    });
    return () => {
      cancelado = true;
    };
  }, [lerStatus]);

  // Polling só existe enquanto atualiza; o cleanup cancela ao terminar ou desmontar.
  useEffect(() => {
    if (fase !== "atualizando") return;
    let cancelado = false;
    let emVoo = false;
    const id = setInterval(async () => {
      if (emVoo) return;
      emVoo = true;
      const s = await lerStatus();
      emVoo = false;
      if (cancelado || !s) return; // falha transitória: tenta no próximo ciclo
      setStatus(s);
      if (s.running) return;
      setErros(s.has_current_error ? s.errors : []);
      setOutraRodada(false);
      setFase("ocioso");
      aoTerminarRef.current();
    }, ATUALIZAR_POLL_MS);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [fase, lerStatus]);

  async function aoClicar() {
    if (enviandoRef.current || fase === "atualizando") return;
    enviandoRef.current = true;
    setEnviando(true);
    setMensagem(null);
    setErros([]);
    try {
      const res = await fetch(REFRESH_URL, { method: "POST" });
      if (res.status === 202) {
        const corpo = (await res.json().catch(() => ({}))) as { skipped?: string };
        setOutraRodada(Boolean(corpo.skipped));
        setFase("atualizando");
      } else if (res.status === 429) {
        setMensagem("Os dados foram atualizados há pouco. Tente novamente em alguns minutos.");
        const s = await lerStatus();
        if (s) setStatus(s);
      } else if (res.status === 401 || res.status === 403) {
        setMensagem("Sem permissão para atualizar os dados.");
      } else {
        setMensagem("Não foi possível iniciar a atualização. Tente novamente.");
      }
    } catch {
      setMensagem("Falha de rede ao iniciar a atualização. Tente novamente.");
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  const atualizando = fase === "atualizando";
  // Só desabilita quando o servidor disse que não pode (intervalo); sem leitura, o servidor decide.
  const bloqueado = !atualizando && status !== null && !status.can_refresh && !status.running;
  const desabilitado = atualizando || enviando || bloqueado;

  let rotulo = "Atualizar Agora";
  let dica: string | null = null;
  if (atualizando) {
    rotulo = outraRodada ? "Já há uma coleta em andamento…" : "Atualizando…";
  } else if (bloqueado) {
    let minutos: number | null = null;
    if (status?.last_finished_at) {
      const t = new Date(status.last_finished_at).getTime();
      if (!Number.isNaN(t)) {
        minutos = Math.max(0, Math.floor(((agora ? agora() : new Date()).getTime() - t) / 60000));
      }
    }
    dica = minutos === null ? "Dados atualizados há pouco" : `Dados atualizados ${formatAge(minutos)}`;
  }

  return (
    <div className="grid min-w-0 gap-1.5" data-testid="atualizar-agora">
      <span className="text-xs text-v2-nevoa/60">Dados</span>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="atualizar-agora-botao"
          data-state={atualizando ? "atualizando" : bloqueado ? "bloqueado" : "ocioso"}
          disabled={desabilitado}
          aria-busy={atualizando}
          onClick={aoClicar}
          className={cx(
            "inline-flex h-10 items-center gap-2 rounded-v2-sm bg-v2-abismo/40 px-4 text-sm text-v2-nevoa ring-1 ring-inset ring-v2-azul-luz/20 hover:ring-v2-azul-luz/40 disabled:cursor-not-allowed disabled:opacity-60",
            foco,
          )}
        >
          {atualizando && (
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border-2 border-v2-azul-luz/30 border-t-v2-azul-luz motion-reduce:animate-none"
            />
          )}
          {rotulo}
        </button>
        {dica && (
          <span className="text-xs text-v2-nevoa/60" data-testid="atualizar-agora-dica">
            {dica}
          </span>
        )}
      </div>

      {mensagem && (
        <div role="alert" className="text-xs text-v2-nevoa/80" data-testid="atualizar-agora-mensagem">
          {mensagem}
        </div>
      )}

      {erros.length > 0 && (
        <div role="alert" className="text-xs text-v2-nevoa/80" data-testid="atualizar-agora-erros">
          <div className="font-medium">A coleta terminou com erro em:</div>
          <ul className="mt-1 list-disc pl-4">
            {erros.map((e) => (
              <li key={e.account_id} data-testid="atualizar-agora-erro">
                <strong>{e.name}</strong> ({PLATAFORMA[e.platform] ?? e.platform})
                {e.last_error_message ? `: ${e.last_error_message}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
