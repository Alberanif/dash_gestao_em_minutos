"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Selo, Surface, Tabela, Td, Th } from "../../ui";
import { cx, foco } from "../../ui/cx";
import type { LogColeta } from "./logs";

const LIMITE_ERRO = 60;

function BotaoCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={copiado ? "Mensagem copiada" : "Copiar mensagem de erro"}
      title={copiado ? "Copiada" : "Copiar mensagem de erro"}
      className={cx(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-v2-sm text-v2-nevoa/60 hover:text-v2-nevoa",
        foco,
      )}
    >
      {copiado ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8.5 6.5 12 13 4.5" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
        </svg>
      )}
    </button>
  );
}

type Props = {
  logs: LogColeta[];
  carregando: boolean;
  erro: boolean;
  aoTentarDeNovo: () => void;
};

export function HistoricoDeColetas({ logs, carregando, erro, aoTentarDeNovo }: Props) {
  return (
    <Surface className="v2-entra flex flex-col gap-4" style={{ "--i": 3 } as React.CSSProperties}>
      <h2 className="m-0 text-base font-semibold">Histórico de coletas</h2>

      {carregando ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Carregando o histórico">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="v2-esq h-10 rounded-v2-sm bg-v2-nevoa/10" />
          ))}
        </div>
      ) : erro ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="m-0 text-sm text-v2-nevoa/75">
            Não foi possível carregar o histórico. Confira a conexão e tente de novo.
          </p>
          <Button variante="secundario" onClick={aoTentarDeNovo}>
            Tentar de novo
          </Button>
        </div>
      ) : logs.length === 0 ? (
        <p className="m-0 text-sm text-v2-nevoa/65">Nenhuma coleta registrada</p>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <Th>Status</Th>
              <Th>Conta</Th>
              <Th>Início</Th>
              <Th>Duração</Th>
              <Th>Registros</Th>
              <Th>Erro</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <Td>
                  <Selo tom={l.status === "success" ? "ok" : "erro"}>{l.status === "success" ? "Concluída" : "Falhou"}</Selo>
                </Td>
                <Td>{l.account_name ?? "—"}</Td>
                <Td className="whitespace-nowrap">{l.started_at ? new Date(l.started_at).toLocaleString("pt-BR") : "—"}</Td>
                <Td>{l.duration_s != null ? `${l.duration_s}s` : "—"}</Td>
                <Td>{l.records_collected != null ? l.records_collected.toLocaleString("pt-BR") : "—"}</Td>
                <Td>
                  {l.error_message ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span title={l.error_message} className="text-v2-queda">
                        {l.error_message.length > LIMITE_ERRO
                          ? `${l.error_message.slice(0, LIMITE_ERRO)}…`
                          : l.error_message}
                      </span>
                      <BotaoCopiar texto={l.error_message} />
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </Surface>
  );
}
