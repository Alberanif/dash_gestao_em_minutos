"use client";

import { useMemo, useState } from "react";
import { resolveDebriefingProducts } from "@/lib/indicadores/debriefing-products";
import { selectDebriefingProducts } from "@/lib/indicadores/debriefing-selection";
import { useEvento } from "../contexto";
import { cx } from "../../ui/cx";
import { EstadoCarregando, EstadoErro, EstadoSemProdutoPrincipal, EstadoSemVendas } from "./estados";
import { Resultado } from "./resultado";
import { SeletorProdutos } from "./seletor-produtos";
import { useDebriefing } from "./use-debriefing";
import { fmtDate } from "./formatar";

/** Visão Debriefing (carregada sob demanda). Só existe montada com a visão ativa, então a consulta só roda aqui. */
export function TelaDebriefing() {
  const { filter, periodo } = useEvento();
  const produtos = useMemo(() => resolveDebriefingProducts(filter), [filter]);
  const { startDate, endDate } = periodo;
  const consulta = useDebriefing({ startDate, endDate, produtos, ativo: true });

  // Seleção dos chips (vazio = Todos). Volta para Todos ao trocar período ou produtos do filtro (regra da V1):
  // a seleção guarda a chave a que pertence e só vale enquanto a chave atual for a mesma.
  const chave = JSON.stringify([startDate, endDate, produtos]);
  const [escolha, setEscolha] = useState<{ chave: string; ids: string[] }>({ chave, ids: [] });
  const selecionados = escolha.chave === chave ? escolha.ids : [];

  const metrics = consulta.data;
  const visivel = useMemo(
    () => (metrics ? selectDebriefingProducts(metrics, selecionados) : null),
    [metrics, selecionados],
  );

  if (produtos.length === 0) {
    return (
      <section aria-label="Debriefing" data-testid="tela-debriefing">
        <EstadoSemProdutoPrincipal />
      </section>
    );
  }

  let corpo: React.ReactNode;
  if (!visivel) {
    corpo = consulta.isError ? (
      <EstadoErro aoTentarDeNovo={() => void consulta.refetch()} tentando={consulta.isFetching} />
    ) : (
      <EstadoCarregando />
    );
  } else {
    const nomes = (selecionados.length === 0 ? produtos : produtos.filter((p) => selecionados.includes(p.product_id)))
      .map((p) => p.product_name);
    corpo = (
      <div data-testid="debriefing-conteudo" className="space-y-6">
        <SeletorProdutos
          produtos={produtos}
          selecionados={selecionados}
          onChange={(ids) => setEscolha({ chave, ids })}
        />
        {visivel.totals.total_sales === 0 ? (
          <EstadoSemVendas
            produto={nomes.length === 1 ? `de ${nomes[0]}` : "dos produtos principais"}
            de={fmtDate(startDate)}
            ate={fmtDate(endDate)}
          />
        ) : (
          <>
            <Resultado totais={visivel.totals} />
            {/* TODO(#297): <EvolucaoDiaria /> com visivel.daily_series (consolidada ou do produto selecionado). */}
            {/* TODO(#298): lista de <BlocoProduto /> a partir de visivel.products. */}
          </>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Debriefing" data-testid="tela-debriefing" aria-busy={consulta.isFetching}>
      {/* Troca de período: o dado anterior fica na tela, esmaecido, até o novo chegar (só opacity). */}
      <div className={cx(consulta.isPlaceholderData && "opacity-50")}>
        {corpo}
      </div>
    </section>
  );
}
