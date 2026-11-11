"use client";

import { useEffect, useState } from "react";
import type {
  VendasViewDailyRow,
  VendasViewHourlyRow,
  VendasViewKpis,
  VendasViewOfferRow,
  VendasViewRecord,
} from "@/types/vendas";
import { viewRangeFrom, type DateRange } from "@/lib/vendas/date-range";

export interface DadosDaVisualizacao {
  kpis: VendasViewKpis;
  daily: VendasViewDailyRow[];
  // Opcional: sem a série horária só some o switch Dia/Hora.
  hourly: VendasViewHourlyRow[] | null;
  offers: VendasViewOfferRow[];
}

function consulta(range: DateRange | null): string {
  return range ? `?start=${range.start}&end=${range.end}` : "";
}

async function lerJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  return (await res.json()) as T;
}

/**
 * Lê KPIs, vendas por dia, por oferta e (opcional) por hora de uma visualização.
 * Os números dependem da visualização (id, ofertas, período) e do que o servidor
 * coletou desde então (last_refresh_at, estado da coleta); `recarregar` força nova leitura.
 * Trocar o período mantém o dado anterior e marca `atualizando` até o novo chegar.
 */
export function useDadosDaVisualizacao(view: VendasViewRecord) {
  const range = viewRangeFrom(view.view_start_date, view.view_end_date);
  const chaveDoPeriodo = range ? `${range.start}|${range.end}` : "";

  const [carregado, setCarregado] = useState<{ chave: string; dados: DadosDaVisualizacao } | null>(null);
  const [erro, setErro] = useState(false);
  const [token, setToken] = useState(0);

  const chave = [
    view.id,
    chaveDoPeriodo,
    view.offer_codes.join(","),
    view.last_refresh_at ?? "",
    view.backfill_status,
    token,
  ].join("#");

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      setErro(false);
      const base = `/api/vendas/views/${view.id}`;
      const q = consulta(range);
      try {
        const [kpis, daily, offers, hourly] = await Promise.all([
          lerJson<VendasViewKpis>(`${base}/kpis${q}`),
          lerJson<{ rows: VendasViewDailyRow[] }>(`${base}/daily${q}`),
          lerJson<{ rows: VendasViewOfferRow[] }>(`${base}/offers${q}`),
          lerJson<{ rows: VendasViewHourlyRow[] }>(`${base}/hourly${q}`).catch(() => null),
        ]);
        if (cancelado) return;
        setCarregado({
          chave,
          dados: {
            kpis,
            daily: daily.rows ?? [],
            offers: offers.rows ?? [],
            hourly: hourly ? (hourly.rows ?? []) : null,
          },
        });
      } catch {
        if (!cancelado) setErro(true);
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
    // `range` deriva de chaveDoPeriodo; a chave inteira já cobre as dependências.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return {
    range,
    dados: carregado?.dados ?? null,
    erro,
    atualizando: carregado !== null && carregado.chave !== chave && !erro,
    recarregar: () => setToken((t) => t + 1),
  };
}
