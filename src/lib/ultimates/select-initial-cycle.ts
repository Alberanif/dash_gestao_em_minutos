import type { UltimatesCycleStatus } from "@/types/ultimates";

interface CycleLike {
  id: string;
  status: UltimatesCycleStatus;
}

// Escolhe o ciclo inicial exibido na tela /ultimates.
//
// Contrato: `cycles` deve vir ordenado por created_at desc, como devolve
// GET /api/ultimates/cycles — este helper depende dessa ordem, não reordena.
//
// Regra (PRD issue #114, critério 11): abre no ciclo "ativo" mais recente.
// Se não houver nenhum ativo (todos encerrados), cai no mais recente entre
// todos — nunca deixa a tela sem seleção havendo ao menos um ciclo.
export function selectInitialCycleId<T extends CycleLike>(cycles: T[]): string | null {
  if (cycles.length === 0) return null;
  const mostRecentActive = cycles.find((cycle) => cycle.status === "ativo");
  return (mostRecentActive ?? cycles[0]).id;
}
