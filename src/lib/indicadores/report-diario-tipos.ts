/** Contrato do Report Diário: a camada de dados produz, o card consome. */

/** Leads, investimento e CPL de uma janela de tempo. null = fonte ausente ou sem dado. */
export interface ReportJanela {
  leads: number | null;
  spend: number | null;
  /** null quando leads = 0 ou uma das fontes está ausente (nunca R$ 0). */
  cpl: number | null;
}

export interface ReportFunil {
  id: string;
  nome: string;
  /** Todo o período da ação, do início até hoje (BRT). Mesma semântica de EventoMetrics. */
  periodo: ReportJanela;
}

/** Mapa por id de filtro. null = a consulta daquele funil falhou (card mostra "indisponível"). */
export type ReportDiarioMapa = Record<string, ReportFunil | null>;
