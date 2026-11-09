"use client";

import { useMemo } from "react";
import { resolveDebriefingProducts } from "@/lib/indicadores/debriefing-products";
import { useEvento } from "../contexto";
import { cx } from "../../ui/cx";
import { EstadoCarregando, EstadoErro, EstadoSemProdutoPrincipal, EstadoSemVendas } from "./estados";
import { useDebriefing } from "./use-debriefing";
import { fmtDate } from "./formatar";

/** Visão Debriefing (carregada sob demanda). Só existe montada com a visão ativa, então a consulta só roda aqui. */
export function TelaDebriefing() {
  const { filter, periodo } = useEvento();
  const produtos = useMemo(() => resolveDebriefingProducts(filter), [filter]);
  const { startDate, endDate } = periodo;
  const consulta = useDebriefing({ startDate, endDate, produtos, ativo: true });

  if (produtos.length === 0) {
    return (
      <section aria-label="Debriefing" data-testid="tela-debriefing">
        <EstadoSemProdutoPrincipal />
      </section>
    );
  }

  const metrics = consulta.data;
  let corpo: React.ReactNode;
  if (!metrics) {
    corpo = consulta.isError ? (
      <EstadoErro aoTentarDeNovo={() => void consulta.refetch()} tentando={consulta.isFetching} />
    ) : (
      <EstadoCarregando />
    );
  } else if (metrics.totals.total_sales === 0) {
    const nome = produtos.length === 1 ? `de ${produtos[0].product_name}` : "dos produtos principais";
    corpo = <EstadoSemVendas produto={nome} de={fmtDate(startDate)} ate={fmtDate(endDate)} />;
  } else {
    // TODO(#296): chips + resultado; TODO(#297): <EvolucaoDiaria />; TODO(#298): lista de <BlocoProduto />.
    corpo = <div data-testid="debriefing-conteudo" />;
  }

  return (
    <section aria-label="Debriefing" data-testid="tela-debriefing" aria-busy={consulta.isFetching}>
      {/* Troca de período: o dado anterior fica na tela, esmaecido, até o novo chegar (só opacity). */}
      <div className={cx(consulta.isPlaceholderData && "opacity-50")}>{corpo}</div>
    </section>
  );
}
