// Agregação de KPIs do dashboard do ciclo a partir de UMA chamada ao roster
// (PRD issue #114, seção 3.2, critério 9) — feita no cliente para que os
// números batam exatamente com a tabela (mesma fonte de dados).
import type { UltimatesRosterRow } from "@/types/ultimates";

export interface RosterKpis {
  // Linhas da base de compradores (buyer_id != null) — denominador do % de
  // renovação. Novos compradores (buyer_id null) não entram na base.
  base: number;
  renovados: number;
  // 0–100, sem casas decimais fixas aqui — quem exibe formata com fmtPercent1.
  renovadosPercent: number;
  renovacaoReembolsada: number;
  naoRenovados: number;
  // novo_comprador + novo_reembolsado.
  novosCompradores: number;
  // Só novo_reembolsado, para destaque "(+N ⟲)" ao lado de novosCompradores.
  novosReembolsados: number;
}

export function aggregateRosterKpis(rows: UltimatesRosterRow[]): RosterKpis {
  const baseRows = rows.filter((r) => r.buyer_id !== null);
  const base = baseRows.length;
  const renovados = baseRows.filter((r) => r.category === "renovado").length;
  const renovacaoReembolsada = baseRows.filter(
    (r) => r.category === "renovacao_reembolsada"
  ).length;
  const naoRenovados = baseRows.filter((r) => r.category === "nao_renovado").length;

  const novosReembolsados = rows.filter((r) => r.category === "novo_reembolsado").length;
  const novosCompradores = rows.filter(
    (r) => r.category === "novo_comprador" || r.category === "novo_reembolsado"
  ).length;

  const renovadosPercent = base > 0 ? (renovados / base) * 100 : 0;

  return {
    base,
    renovados,
    renovadosPercent,
    renovacaoReembolsada,
    naoRenovados,
    novosCompradores,
    novosReembolsados,
  };
}
