"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { FilterRecord } from "@/types/indicadores";
import { montarConsulta, type Consulta } from "@/lib/indicadores/dashboard-evento";
import { calcPresetDates, getActivePreset, type PresetKey } from "@/lib/utils/period-presets";
import type { Visao } from "./visao";

export interface PeriodoEvento {
  startDate: string;
  endDate: string;
  preset: PresetKey | null;
}

interface ContextoEvento {
  filter: FilterRecord;
  filters: FilterRecord[];
  consulta: Consulta;
  /** Chave da consulta que o servidor já respondeu (os blocos usam como dado inicial). */
  chaveInicial: string;
  periodo: PeriodoEvento;
  /** YYYY-MM-DD do servidor. */
  hoje: string;
  escolherPreset: (key: PresetKey) => void;
  escolherDatas: (startDate: string, endDate: string) => void;
  /** Visão do corpo da página (`?view=`). Trocar só muda o corpo: herói e cena seguem montados. */
  visao: Visao;
  escolherVisao: (visao: Visao) => void;
}

const Contexto = createContext<ContextoEvento | null>(null);

export function useEvento(): ContextoEvento {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useEvento fora do ProvedorEvento");
  return ctx;
}

function novoCliente() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } } });
}

/** O período mora na URL (`?de=&ate=`) para o link ser compartilhável; replaceState não refaz a página no servidor. */
function gravarNaUrl(periodo: PeriodoEvento, padrao: PeriodoEvento) {
  const url = new URL(window.location.href);
  if (periodo.startDate === padrao.startDate && periodo.endDate === padrao.endDate) {
    url.searchParams.delete("de");
    url.searchParams.delete("ate");
  } else {
    url.searchParams.set("de", periodo.startDate);
    url.searchParams.set("ate", periodo.endDate);
  }
  window.history.replaceState(null, "", url);
}

/** `?view=debriefing` na URL; o padrão (dashboard) sai dela. Preserva `de`/`ate`. */
function gravarVisaoNaUrl(visao: Visao) {
  const url = new URL(window.location.href);
  if (visao === "dashboard") url.searchParams.delete("view");
  else url.searchParams.set("view", visao);
  window.history.replaceState(null, "", url);
}

export function ProvedorEvento({
  filter,
  filters,
  periodoInicial,
  hoje,
  visaoInicial = "dashboard",
  children,
}: {
  filter: FilterRecord;
  filters: FilterRecord[];
  periodoInicial: PeriodoEvento;
  /** YYYY-MM-DD do servidor: o cliente não recalcula "hoje" na hidratação. */
  hoje: string;
  visaoInicial?: Visao;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(novoCliente);
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [padrao] = useState(periodoInicial);
  const [visao, setVisao] = useState<Visao>(visaoInicial);

  const escolherVisao = useCallback((proxima: Visao) => {
    setVisao(proxima);
    gravarVisaoNaUrl(proxima);
  }, []);

  const aplicar = useCallback(
    (proximo: PeriodoEvento) => {
      setPeriodo(proximo);
      gravarNaUrl(proximo, padrao);
    },
    [padrao],
  );

  const escolherPreset = useCallback(
    (key: PresetKey) => aplicar({ ...calcPresetDates(key, hoje), preset: key }),
    [aplicar, hoje],
  );

  const escolherDatas = useCallback(
    (startDate: string, endDate: string) => {
      if (!startDate || !endDate || startDate > endDate) return;
      aplicar({ startDate, endDate, preset: getActivePreset(startDate, endDate, hoje) });
    },
    [aplicar, hoje],
  );

  const consulta = useMemo(
    () => montarConsulta(filter, { startDate: periodo.startDate, endDate: periodo.endDate }),
    [filter, periodo.startDate, periodo.endDate],
  );
  const chaveInicial = useMemo(
    () => montarConsulta(filter, { startDate: periodoInicial.startDate, endDate: periodoInicial.endDate }).chave,
    [filter, periodoInicial.startDate, periodoInicial.endDate],
  );

  const valor = useMemo(
    () => ({ filter, filters, consulta, chaveInicial, periodo, hoje, escolherPreset, escolherDatas, visao, escolherVisao }),
    [filter, filters, consulta, chaveInicial, periodo, hoje, escolherPreset, escolherDatas, visao, escolherVisao],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Contexto.Provider value={valor}>{children}</Contexto.Provider>
    </QueryClientProvider>
  );
}
