// Tipos locais da UI de Dash Ultimates. Não editamos src/types/ultimates.ts
// (restrição da task #122) — este arquivo só estende o que já existe lá para
// o formato específico que a UI consome.
import type { UltimatesCycleRecord } from "@/types/ultimates";

// Espelha UltimatesCycleWithProductName de
// src/app/api/ultimates/cycles/route.ts (GET anexa product_name via join em
// memória). Definido aqui em vez de importado da rota para não puxar código
// server-only (next/server) para o bundle de cliente.
export interface CycleWithProduct extends UltimatesCycleRecord {
  product_name: string | null;
}

export interface HotmartProductOption {
  product_id: string;
  product_name: string;
}
