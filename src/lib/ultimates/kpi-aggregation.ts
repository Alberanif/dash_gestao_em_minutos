// Agregação de KPIs do dashboard do ciclo a partir de UMA chamada ao roster
// (PRD issue #114, seção 3.2, critério 9) — feita no cliente para que os
// números batam exatamente com a tabela (mesma fonte de dados).
//
// Esta função conhece as CATEGORIAS de renovação sem vínculo, mas não conhece o
// switch: quem reetiqueta é applyNewPurchasesModeToRoster, que roda antes. Com
// o ciclo admitindo novas compras, nenhuma linha tem essas categorias e o
// resultado é idêntico ao de antes da migration 053.
import type { UltimatesRosterRow } from "@/types/ultimates";

export interface RosterKpis {
  // Linhas da base de compradores (buyer_id != null) — denominador do % de
  // renovação. Nem novos compradores nem renovações sem vínculo entram na base:
  // quem renovou com outro email JÁ está na base, só não foi identificado, então
  // o denominador continua correto sem eles.
  base: number;
  // Renovados identificados + renovações sem vínculo aprovadas.
  renovados: number;
  // 0–100, sem casas decimais fixas aqui — quem exibe formata com fmtPercent1.
  // PODE passar de 100%: significa mais renovações não-vinculadas do que não
  // renovados, ou seja, a premissa "este ciclo não tem novos compradores" está
  // errada. É sinal, não bug — GoalProgressBar já clampa a barra.
  renovadosPercent: number;
  // Reembolsadas identificadas + reembolsadas sem vínculo.
  renovacaoReembolsada: number;
  naoRenovados: number;
  // novo_comprador + novo_reembolsado.
  novosCompradores: number;
  // Só novo_reembolsado, para destaque "(+N ⟲)" ao lado de novosCompradores.
  novosReembolsados: number;
  // Só renovacao_sem_vinculo (aprovadas) — o "(+N sem vínculo)" do tile
  // "Renovados", e a parcela que soma em renovados.
  renovacoesSemVinculo: number;
  // Só renovacao_sem_vinculo_reembolsada — o "(+N sem vínculo)" do tile
  // "Renovação reembolsada".
  renovacoesSemVinculoReembolsadas: number;
  // Quantos dos naoRenovados provavelmente renovaram com outro email. É o
  // mínimo entre as duas contagens porque não pode haver mais base-renovada-em-
  // -segredo do que gente que consta como não renovada. Alimenta a dica do tile
  // "Não renovados" — nunca abate o valor dele (o tile precisa continuar batendo
  // com o filtro da tabela, critério 9).
  possivelmenteRenovados: number;
}

export function aggregateRosterKpis(rows: UltimatesRosterRow[]): RosterKpis {
  const baseRows = rows.filter((r) => r.buyer_id !== null);
  const base = baseRows.length;
  const renovadosBase = baseRows.filter((r) => r.category === "renovado").length;
  const renovacaoReembolsadaBase = baseRows.filter(
    (r) => r.category === "renovacao_reembolsada"
  ).length;
  const naoRenovados = baseRows.filter((r) => r.category === "nao_renovado").length;

  const novosReembolsados = rows.filter((r) => r.category === "novo_reembolsado").length;
  const novosCompradores = rows.filter(
    (r) => r.category === "novo_comprador" || r.category === "novo_reembolsado"
  ).length;

  const renovacoesSemVinculo = rows.filter(
    (r) => r.category === "renovacao_sem_vinculo"
  ).length;
  const renovacoesSemVinculoReembolsadas = rows.filter(
    (r) => r.category === "renovacao_sem_vinculo_reembolsada"
  ).length;

  const renovados = renovadosBase + renovacoesSemVinculo;
  const renovacaoReembolsada = renovacaoReembolsadaBase + renovacoesSemVinculoReembolsadas;
  const renovadosPercent = base > 0 ? (renovados / base) * 100 : 0;

  return {
    base,
    renovados,
    renovadosPercent,
    renovacaoReembolsada,
    naoRenovados,
    novosCompradores,
    novosReembolsados,
    renovacoesSemVinculo,
    renovacoesSemVinculoReembolsadas,
    possivelmenteRenovados: Math.min(renovacoesSemVinculo, naoRenovados),
  };
}
