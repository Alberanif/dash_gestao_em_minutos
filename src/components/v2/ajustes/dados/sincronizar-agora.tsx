"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Selo, Surface } from "../../ui";
import { ERRO_REDE, ROTULO_PLATAFORMA, type PlataformaDados } from "./lote";
import { logMaisRecente, tempoRelativo, type LogColeta } from "./logs";

type Props = {
  plataforma: PlataformaDados;
  logs: LogColeta[];
  logsCarregando: boolean;
  /** Recarrega o histórico depois de uma sincronização bem-sucedida. */
  aoConcluir: () => void | Promise<void>;
  aoOcupar?: (ocupado: boolean) => void;
};

/** Resumo da última coleta, derivado dos logs já carregados, e o botão de sincronização manual. */
export function SincronizarAgora({ plataforma, logs, logsCarregando, aoConcluir, aoOcupar }: Props) {
  const rotulo = ROTULO_PLATAFORMA[plataforma];
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    aoOcupar?.(sincronizando);
    return () => aoOcupar?.(false);
  }, [sincronizando, aoOcupar]);

  async function sincronizar() {
    setSincronizando(true);
    setErro(null);
    setSucesso(false);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: plataforma }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (montado.current) setErro(json.error ?? "Erro desconhecido ao sincronizar");
      } else {
        if (montado.current) setSucesso(true);
        await aoConcluir();
      }
    } catch {
      if (montado.current) setErro(ERRO_REDE);
    } finally {
      if (montado.current) setSincronizando(false);
    }
  }

  const ultimo = logMaisRecente(logs);

  return (
    <Surface className="v2-entra flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ "--i": 0 } as React.CSSProperties}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 className="m-0 text-base font-semibold">Sincronizar agora</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-v2-nevoa/75">
          {logsCarregando ? (
            <span className="v2-esq block h-5 w-56 rounded-v2-sm bg-v2-nevoa/10" aria-label="Carregando a última coleta" role="status" />
          ) : ultimo ? (
            <>
              <span>Última coleta:</span>
              <Selo tom={ultimo.status === "success" ? "ok" : "erro"}>
                {ultimo.status === "success" ? "Concluída" : "Falhou"}
              </Selo>
              <span>
                {tempoRelativo(ultimo.started_at)}
                {ultimo.records_collected != null
                  ? `, ${ultimo.records_collected.toLocaleString("pt-BR")} registros`
                  : ""}
              </span>
            </>
          ) : (
            <span>Nenhuma coleta registrada ainda.</span>
          )}
        </div>
        <div aria-live="polite" className="flex flex-col gap-1">
          {sucesso ? (
            <Selo tom="ok" className="w-fit">
              Sincronização concluída
            </Selo>
          ) : null}
          {erro ? (
            <>
              <Selo tom="erro" className="h-auto min-h-6 w-fit max-w-full whitespace-normal py-1">
                {erro}
              </Selo>
              <p className="m-0 text-xs text-v2-nevoa/55">Tente de novo em instantes. Se repetir, veja o erro no histórico abaixo.</p>
            </>
          ) : null}
        </div>
      </div>
      <Button onClick={sincronizar} disabled={sincronizando} className="w-full shrink-0 sm:w-auto">
        {sincronizando ? "Sincronizando..." : `Sincronizar ${rotulo}`}
      </Button>
    </Surface>
  );
}
