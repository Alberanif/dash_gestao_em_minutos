"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Campo, Input, Select, Selo, Surface } from "../../ui";
import { cx } from "../../ui/cx";
import { CONFIG_LOTE, LOTE_OCIOSO, executarLote, type Chunk, type EstadoLote, type PlataformaDados } from "./lote";
import type { ContaPlataforma } from "./logs";

const fmt = (n: number) => n.toLocaleString("pt-BR");

const ROTULO_CHUNK: Record<Chunk["status"], string> = {
  pending: "Na fila",
  loading: "Coletando",
  success: "Concluído",
  error: "Falhou",
};

const TOM_CHUNK: Record<Chunk["status"], string> = {
  pending: "text-v2-nevoa/50",
  loading: "text-v2-azul-luz",
  success: "text-v2-alta",
  error: "text-v2-queda",
};

type Props = {
  plataforma: PlataformaDados;
  contas: ContaPlataforma[];
  contasCarregando: boolean;
  /** Chamado quando a coleta termina com sucesso, para recarregar o histórico. */
  aoConcluir: () => void | Promise<void>;
  aoOcupar?: (ocupado: boolean) => void;
};

/** Formulário único das quatro coletas em lote; o que muda por plataforma vem de CONFIG_LOTE. */
export function LoteColeta({ plataforma, contas, contasCarregando, aoConcluir, aoOcupar }: Props) {
  const config = CONFIG_LOTE[plataforma];
  const [contaEscolhida, setContaEscolhida] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [estado, setEstado] = useState<EstadoLote>(LOTE_OCIOSO);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const carregando = estado.status === "loading";
  useEffect(() => {
    aoOcupar?.(carregando);
    return () => aoOcupar?.(false);
  }, [carregando, aoOcupar]);

  // Sem escolha explícita (ou com a conta sumida da lista), vale a primeira, como no V1.
  const contaId = contas.some((c) => c.id === contaEscolhida) ? contaEscolhida : (contas[0]?.id ?? "");
  const intervaloInvertido = !!inicio && !!fim && inicio > fim;
  const podeExecutar = !!contaId && !!inicio && !!fim && !intervaloInvertido && !carregando;

  function mudarData(set: (v: string) => void, valor: string) {
    set(valor);
    setEstado(LOTE_OCIOSO);
  }

  async function executar() {
    const final = await executarLote({
      config,
      contaId,
      inicio,
      fim,
      aoMudar: (e) => {
        if (montado.current) setEstado(e);
      },
    });
    if (final.status === "success") await aoConcluir();
  }

  const chunks = estado.chunks;
  const concluidos = chunks?.filter((c) => c.status === "success").length ?? 0;
  const fracao = chunks && chunks.length > 0 ? concluidos / chunks.length : 0;

  return (
    <Surface className="v2-entra flex flex-col gap-4" style={{ "--i": 1 } as React.CSSProperties}>
      <div>
        <h2 className="m-0 text-base font-semibold">{config.titulo}</h2>
        <p className="mt-1 text-sm text-v2-nevoa/65">{config.descricao}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr_auto] lg:items-end">
        <Campo
          rotulo="Conta"
          ajuda={!contasCarregando && contas.length === 0 ? "Nenhuma conta conectada nesta plataforma." : undefined}
        >
          {() => (
            <Select
              aria-label="Conta"
              value={contaId}
              onValueChange={setContaEscolhida}
              opcoes={contas.map((c) => ({ value: c.id, label: c.name }))}
              placeholder={contasCarregando ? "Carregando contas" : "Sem contas"}
              disabled={contas.length === 0 || carregando}
            />
          )}
        </Campo>
        <Campo rotulo="Data inicial">
          {(p) => (
            <Input {...p} type="date" value={inicio} disabled={carregando} onChange={(e) => mudarData(setInicio, e.target.value)} />
          )}
        </Campo>
        <Campo
          rotulo="Data final"
          erro={intervaloInvertido}
          ajuda={intervaloInvertido ? "A data final precisa ser igual ou posterior à inicial." : undefined}
        >
          {(p) => (
            <Input {...p} type="date" value={fim} disabled={carregando} onChange={(e) => mudarData(setFim, e.target.value)} />
          )}
        </Campo>
        <Button onClick={executar} disabled={!podeExecutar} className="w-full sm:col-span-2 lg:col-span-1 lg:w-auto">
          {carregando ? "Coletando..." : "Executar coleta"}
        </Button>
      </div>

      {chunks && chunks.length > 0 ? (
        <div className="flex flex-col gap-3" aria-label="Progresso da coleta">
          <p className="m-0 text-sm text-v2-nevoa/75" role="status">
            Progresso: {concluidos}/{chunks.length} lotes
            {carregando ? ` · ${fmt(estado.acumulado)} registros acumulados` : ""}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-v2-nevoa/10" aria-hidden="true">
            <div
              data-testid="barra-progresso"
              className="h-full origin-left rounded-full bg-v2-azul-igt transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${fracao})` }}
            />
          </div>
          <ul className="m-0 flex max-h-56 list-none flex-col gap-1.5 overflow-y-auto p-0 text-xs">
            {chunks.map((c) => (
              <li key={`${c.start}-${c.end}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="font-mono text-v2-nevoa">
                  {c.start} → {c.end}
                </span>
                <span className={cx("font-medium", TOM_CHUNK[c.status])}>{ROTULO_CHUNK[c.status]}</span>
                {c.status === "success" ? (
                  <span className="text-v2-nevoa/65">{fmt(c.records ?? 0)} registros</span>
                ) : null}
                {c.status === "error" && c.error ? <span className="text-v2-queda">{c.error}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {estado.status === "success" && estado.resultado ? (
        <div role="status">
          <Selo tom="ok" className="h-auto min-h-6 whitespace-normal py-1">
            {estado.resultado}
          </Selo>
        </div>
      ) : null}
      {estado.status === "error" && estado.erro ? (
        <div role="alert" className="flex flex-col gap-1">
          <Selo tom="erro" className="h-auto min-h-6 w-fit max-w-full whitespace-normal py-1">
            {estado.erro}
          </Selo>
          <p className="m-0 text-xs text-v2-nevoa/55">
            Confira o intervalo e a conta e execute a coleta de novo.
          </p>
        </div>
      ) : null}
    </Surface>
  );
}
