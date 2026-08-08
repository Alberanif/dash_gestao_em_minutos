import { useEffect, useState } from "react";
import type { SixDadosItem } from "@/lib/indicadores/service/six-dados";
import type { SixDadosCardData } from "@/components/indicadores/six-dados-carousel";

/**
 * Dados da seção Six Dados (PRD seção 5.4, RF-4/RF-5). Encapsula o padrão
 * progressivo de carregamento:
 *
 * 1. GET `/api/indicadores/six-dados` ao montar ⇒ Eventos ativos + cache.
 * 2. Para cada Evento `stale`, dispara POST `/generate` EM PARALELO — uma
 *    request por Evento (invocações serverless independentes, sem timeout
 *    acumulado). Não serializa: todos os POSTs partem juntos.
 * 3. Cada POST que conclui substitui só o seu card (progressivo — os demais
 *    não esperam nem mudam).
 * 4. Erro por Evento é isolado: se havia relatório anterior, mantém texto +
 *    aviso (`error`); se nunca gerou, estado de erro leve sem texto.
 *
 * O array devolvido é exatamente o contrato do carrossel (`SixDadosCardData[]`).
 */

/** GET vazio até o accountId chegar; carrossel some do DOM com 0 itens. */
function itemToCard(item: SixDadosItem, status: SixDadosCardData["status"]): SixDadosCardData {
  return {
    filterId: item.filterId,
    name: item.name,
    reportText: item.report?.text ?? null,
    kpiSnapshot: item.report?.kpiSnapshot ?? null,
    generatedAt: item.report?.generatedAt ?? null,
    status,
  };
}

/** Falha de geração: vira `error` preservando texto/snapshot antigos, se havia. */
function markError(cards: SixDadosCardData[], filterId: string): SixDadosCardData[] {
  return cards.map((card) => (card.filterId === filterId ? { ...card, status: "error" } : card));
}

export interface UseSixDadosResult {
  items: SixDadosCardData[];
}

export function useSixDados(accountId: string | null): UseSixDadosResult {
  const [items, setItems] = useState<SixDadosCardData[]>([]);

  useEffect(() => {
    if (!accountId) return;

    let cancelled = false;
    const controller = new AbortController();

    async function generateOne(item: SixDadosItem) {
      try {
        const res = await fetch("/api/indicadores/six-dados/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filterId: item.filterId }),
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          setItems((prev) => markError(prev, item.filterId));
          return;
        }
        const fresh = (await res.json()) as SixDadosItem;
        if (cancelled) return;
        // 200 não garante sucesso: o perdedor da corrida (`waited`) pode devolver
        // o resultado do vencedor mesmo quando este falhou ao gerar — nesse caso
        // `report` vem `null`/vencido e `stale` continua `true`. Renderizar isso
        // como "ready" mostraria um card vazio; trata como falha de geração.
        const status = fresh.stale || !fresh.report ? "error" : "ready";
        setItems((prev) =>
          prev.map((card) => (card.filterId === item.filterId ? itemToCard(fresh, status) : card))
        );
      } catch {
        // Aborto do unmount ou falha de rede: só reflete se ainda montado.
        if (cancelled) return;
        setItems((prev) => markError(prev, item.filterId));
      }
    }

    async function load() {
      let list: SixDadosItem[];
      try {
        const res = await fetch(`/api/indicadores/six-dados?account_id=${accountId}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;
        list = data as SixDadosItem[];
      } catch {
        // GET falhou (rede/servidor) — seção fica vazia, não quebra a tela.
        return;
      }
      if (cancelled) return;

      // Estado inicial: cache renderiza na hora; vencidos entram em `generating`
      // (mantendo snapshot/texto anteriores, se houver, p/ skeleton parcial).
      setItems(list.map((item) => itemToCard(item, item.stale ? "generating" : "ready")));

      // RF-4: um POST por Evento stale, todos disparados juntos (paralelo).
      for (const item of list) {
        if (item.stale) void generateOne(item);
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accountId]);

  return { items };
}
