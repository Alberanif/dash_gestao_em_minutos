// Dash Ultimates: monitoramento de ciclo de renovação (PRD: issue #114).
// Espelham as colunas de supabase/migrations/049_dash_gestao_ultimates.sql.

export type UltimatesCycleStatus = "ativo" | "encerrado";

export interface UltimatesCycleRecord {
  id: string;
  name: string;
  account_id: string;
  product_id: string;
  goal_percent: number | null;
  status: UltimatesCycleStatus;
  refresh_started_at: string | null;
  last_refresh_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UltimatesBuyerRecord {
  id: string;
  cycle_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  extra: Record<string, unknown>;
  created_at: string;
}

export interface UltimatesManualLinkRecord {
  id: string;
  cycle_id: string;
  buyer_id: string;
  transaction_code: string;
  linked_by: string;
  created_at: string;
}

// Categorias de classificação do cruzamento base-de-compradores x vendas
// Hotmart, usadas pelo restante da feature (RPCs, API, UI).
export type UltimatesCategory =
  | "renovado"
  | "nao_renovado"
  | "renovacao_reembolsada"
  | "novo_comprador"
  | "novo_reembolsado";
