"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Surface } from "../../../ui";
import { buscarResultado } from "./api-resultado";
import { Cabecalho, Comparativo, Cortes, Funil, Saude, Veredito } from "./blocos";
import { Filtros } from "./filtros";
import { GraficoDiario } from "./grafico-diario";
import type { DimensaoChave, FiltrosDoResultado, ResultadoAb } from "./tipos";

type Resposta = { chave: string; dados?: ResultadoAb; erro?: string };

export function TelaDeResultado({ testeId }: { testeId: string }) {
  const [filtros, setFiltros] = useState<FiltrosDoResultado>({});
  const [tentativa, setTentativa] = useState(0);
  const [resposta, setResposta] = useState<Resposta | null>(null);

  // Cada combinação de filtros (e cada nova tentativa) é uma chave; sem resposta para a chave atual, está carregando.
  const chave = useMemo(() => JSON.stringify([testeId, filtros, tentativa]), [testeId, filtros, tentativa]);

  useEffect(() => {
    let vivo = true;
    buscarResultado(testeId, filtros)
      .then((dados) => vivo && setResposta({ chave, dados }))
      .catch((e: unknown) =>
        vivo && setResposta({ chave, erro: e instanceof Error && e.message ? e.message : "Falha ao carregar o resultado." }),
      );
    return () => {
      vivo = false;
    };
    // `chave` já resume testeId, filtros e tentativa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const carregando = resposta?.chave !== chave;
  const erro = !carregando ? resposta?.erro : undefined;
  const dados = resposta?.dados;

  const ordenado = useMemo<ResultadoAb | null>(() => {
    if (!dados) return null;
    return { ...dados, variantes: [...dados.variantes].sort((a, b) => String(a.rotulo).localeCompare(String(b.rotulo), "pt-BR")) };
  }, [dados]);

  function mudar(dim: DimensaoChave, valor: string) {
    setFiltros((f) => {
      const n = { ...f };
      if (valor) n[dim] = valor;
      else delete n[dim];
      return n;
    });
  }

  if (erro) {
    return (
      <Surface className="flex flex-col items-start gap-3">
        <p role="alert" className="m-0 text-sm text-v2-queda">
          {erro}
        </p>
        <div className="flex gap-2">
          <Button variante="secundario" onClick={() => setTentativa((n) => n + 1)}>
            Tentar de novo
          </Button>
          <Link
            href="/v2/indicadores/testes-ab"
            className="inline-flex h-10 items-center rounded-v2-sm bg-v2-casco-alto px-4 text-sm font-medium text-v2-nevoa shadow-v2-1"
          >
            Voltar para os testes
          </Link>
        </div>
      </Surface>
    );
  }

  if (!ordenado) {
    return (
      <p role="status" className="m-0 text-sm text-v2-nevoa/65">
        Carregando resultado…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={carregando}>
      <Cabecalho dados={ordenado} />
      <Filtros
        disponiveis={ordenado.filtros_disponiveis}
        filtros={filtros}
        ocupado={carregando}
        onMudar={mudar}
        onLimpar={() => setFiltros({})}
      />
      {carregando && (
        <p role="status" className="m-0 text-sm text-v2-nevoa/65">
          Atualizando…
        </p>
      )}
      <Comparativo dados={ordenado} />
      <Veredito dados={ordenado} />
      <GraficoDiario dados={ordenado} />
      <Cortes dados={ordenado} />
      <Funil dados={ordenado} />
      <Saude dados={ordenado} />
    </div>
  );
}
