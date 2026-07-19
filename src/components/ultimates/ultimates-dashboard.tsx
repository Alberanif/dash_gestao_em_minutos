"use client";

import type { UserRole } from "@/types/auth";
import type { CycleWithProduct } from "./types";

// Slot do dashboard do ciclo selecionado. Placeholder — a task #123
// (PRD issue #114, seções 3.2–3.3) substitui o conteúdo por KPIs, gráfico de
// renovação diária e tabela do roster, usando exatamente este contrato de
// props (cycle + role). Não renomeie/altere a assinatura sem avisar quem
// pegar a #123.
export interface UltimatesDashboardProps {
  cycle: CycleWithProduct;
  role: UserRole;
}

export function UltimatesDashboard({ cycle }: UltimatesDashboardProps) {
  return (
    <div
      data-testid="ultimates-dashboard-slot"
      style={{
        border: "1px dashed var(--color-border)",
        borderRadius: "var(--radius-card)",
        padding: 32,
        textAlign: "center",
        color: "var(--color-text-muted)",
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "var(--color-text)" }}>
        Dashboard do ciclo em construção
      </p>
      <p style={{ fontSize: 13, margin: 0 }} data-testid="ultimates-selected-cycle">
        {cycle.name}
      </p>
    </div>
  );
}
