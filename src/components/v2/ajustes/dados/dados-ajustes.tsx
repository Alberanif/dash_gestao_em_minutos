"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PaginaAjustes } from "../pagina";
import { Tabs, TabsList, TabsTrigger } from "../../ui";
import { FilterTransition } from "../../motion/filter-transition";
import { CatalogoHotmart } from "./catalogo-hotmart";
import { HistoricoDeColetas } from "./historico";
import { LoteColeta } from "./lote-coleta";
import { MetaAdsAjustes } from "./meta-ads-ajustes";
import { SincronizarAgora } from "./sincronizar-agora";
import type { ContaPlataforma, LogColeta } from "./logs";
import { PLATAFORMAS, ROTULO_PLATAFORMA, type PlataformaDados } from "./lote";

/** Tela "Dados e sincronização": logs e contas são carregados a cada troca de plataforma, como no V1. */
export function DadosAjustes() {
  const [aba, setAba] = useState<PlataformaDados>("youtube");
  // Logs e contas guardam a plataforma a que pertencem: "carregando" é derivado de a aba já ter mudado
  // (ou de um recarregamento em curso), sem setState síncrono em efeito.
  const [logsDe, setLogsDe] = useState<{ plataforma: PlataformaDados; logs: LogColeta[]; erro: boolean } | null>(null);
  const [recarregando, setRecarregando] = useState(false);
  const [contasDe, setContasDe] = useState<{ plataforma: PlataformaDados; contas: ContaPlataforma[] } | null>(null);
  const [ocupados, setOcupados] = useState<Record<string, boolean>>({});
  const requisicao = useRef(0);

  const logsCarregando = recarregando || logsDe?.plataforma !== aba;
  const logs = logsDe?.plataforma === aba ? logsDe.logs : [];
  const logsErro = logsDe?.plataforma === aba && logsDe.erro;
  const contasCarregando = contasDe?.plataforma !== aba;
  const contas = contasDe?.plataforma === aba ? contasDe.contas : [];

  const carregarLogs = useCallback(async (plataforma: PlataformaDados) => {
    const id = ++requisicao.current;
    let lista: LogColeta[] = [];
    let falhou = false;
    try {
      const res = await fetch(`/api/logs?platform=${plataforma}`);
      const json = await res.json();
      lista = json.logs ?? [];
      falhou = !res.ok;
    } catch {
      falhou = true;
    }
    if (id !== requisicao.current) return;
    setLogsDe({ plataforma, logs: lista, erro: falhou });
    setRecarregando(false);
  }, []);

  useEffect(() => {
    void carregarLogs(aba);
  }, [aba, carregarLogs]);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/accounts?platform=${aba}`)
      .then((r) => r.json())
      .then((accs: ContaPlataforma[]) => (Array.isArray(accs) ? accs : []))
      .catch(() => [] as ContaPlataforma[])
      .then((lista) => {
        if (!cancelado) setContasDe({ plataforma: aba, contas: lista });
      });
    return () => {
      cancelado = true;
    };
  }, [aba]);

  const ocupar = useCallback(
    (chave: string) => (v: boolean) => setOcupados((p) => (p[chave] === v ? p : { ...p, [chave]: v })),
    [],
  );
  // Funções estáveis por chave, para os efeitos dos filhos não reexecutarem a cada render.
  const [ocuparSync] = useState(() => ocupar("sync"));
  const [ocuparLote] = useState(() => ocupar("lote"));
  const [ocuparCatalogo] = useState(() => ocupar("catalogo"));

  const algoEmAndamento = Object.values(ocupados).some(Boolean);
  const recarregar = useCallback(() => {
    setRecarregando(true);
    return carregarLogs(aba);
  }, [aba, carregarLogs]);

  return (
    <PaginaAjustes
      titulo="Dados e sincronização"
      subtitulo="Histórico de coletas, execução manual e monitoramento por plataforma."
    >
      <div className="flex flex-col gap-1.5">
        <div className="max-w-full overflow-x-auto">
          <Tabs value={aba} onValueChange={(v) => setAba(v as PlataformaDados)}>
            <TabsList aria-label="Plataforma">
              {PLATAFORMAS.map((p) => (
                <TabsTrigger key={p} value={p} disabled={algoEmAndamento && p !== aba}>
                  {ROTULO_PLATAFORMA[p]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {algoEmAndamento ? (
          <p className="m-0 text-xs text-v2-nevoa/55">Há uma coleta em andamento. As outras plataformas ficam disponíveis quando ela terminar.</p>
        ) : null}
      </div>

      <FilterTransition filtroKey={aba} className="flex flex-col gap-6">
        <SincronizarAgora
          plataforma={aba}
          logs={logs}
          logsCarregando={logsCarregando}
          aoConcluir={recarregar}
          aoOcupar={ocuparSync}
        />
        <LoteColeta
          plataforma={aba}
          contas={contas}
          contasCarregando={contasCarregando}
          aoConcluir={recarregar}
          aoOcupar={ocuparLote}
        />
        {aba === "hotmart" ? (
          <CatalogoHotmart
            contas={contas}
            contasCarregando={contasCarregando}
            aoConcluir={recarregar}
            aoOcupar={ocuparCatalogo}
          />
        ) : null}
        {aba === "meta-ads" ? <MetaAdsAjustes contas={contas} /> : null}
        <HistoricoDeColetas logs={logs} carregando={logsCarregando} erro={logsErro} aoTentarDeNovo={recarregar} />
      </FilterTransition>
    </PaginaAjustes>
  );
}
