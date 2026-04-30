"use client";

import { PageHeader } from "@/components/layout/page-header";
import { MccFccProjetoSection } from "@/components/entrega-nivel-a/mcc-fcc-projeto-section";
import { FccMccMensalSection } from "@/components/entrega-nivel-a/fcc-mcc-mensal-section";
import { UltimateMensalSection } from "@/components/entrega-nivel-a/ultimate-mensal-section";
import { UltimateProjetoSection } from "@/components/entrega-nivel-a/ultimate-projeto-section";
import { DestraveProjetoSection } from "@/components/entrega-nivel-a/destrave-projeto-section";

export default function EntregaNivelADashboardPage() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="Entrega Nível A"
        subtitle="Acompanhe as métricas de entrega de valor para seus projetos"
      />

      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
        <MccFccProjetoSection />
        <FccMccMensalSection />
        <UltimateMensalSection />
        <UltimateProjetoSection />
        <DestraveProjetoSection />
      </div>
    </div>
  );
}
