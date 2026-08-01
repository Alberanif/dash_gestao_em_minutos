// Tipos locais da UI de Dash Ultimates. Não editamos src/types/ultimates.ts
// (restrição da task #122) — este arquivo só estende o que já existe lá para
// o formato específico que a UI consome.
import type { UltimatesCycleRecord, UltimatesCycleProductRef } from "@/types/ultimates";

// Espelha UltimatesCycleWithProducts de src/app/api/ultimates/cycles/route.ts
// (GET anexa os produtos com dois joins em memória). Definido aqui em vez de
// importado da rota para não puxar código server-only (next/server) para o
// bundle de cliente.
export interface CycleWithProducts extends UltimatesCycleRecord {
  products: UltimatesCycleProductRef[];
}

export interface HotmartProductOption {
  product_id: string;
  product_name: string;
  // Usado pelo modal de criação para travar a seleção numa única conta
  // Hotmart — o refresh busca credenciais uma vez só, pelo account_id do ciclo.
  account_id: string;
}

// Linha da lista devolvida por GET /api/ultimates/cycles/[id]/excluded-offers.
// offer_name e excluded_by_email são resolvidos pela rota e podem ser null
// (oferta ainda não sincronizada / falha ao consultar o auth) — a exibição
// sempre cai de volta no offer_code, que é o dado que identifica a oferta.
export interface ExcludedOffer {
  id: string;
  offer_code: string;
  offer_name: string | null;
  note: string | null;
  excluded_by: string;
  excluded_by_email: string | null;
  created_at: string;
}

// Linha da lista devolvida por GET /api/ultimates/cycles/[id]/excluded-buyers.
// `name` é resolvido pela rota na base do ciclo e vem null quando o email já
// saiu do CSV — a exclusão sobrevive ao upload, a linha da base não. A
// exibição sempre cai de volta no email, que é a chave da exclusão.
export interface ExcludedBuyer {
  id: string;
  email: string;
  name: string | null;
  note: string | null;
  excluded_by: string;
  excluded_by_email: string | null;
  created_at: string;
}
