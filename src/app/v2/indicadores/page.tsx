import { Suspense } from "react";
import type { Metadata } from "next";
import "@/components/v2/indicadores/menu.css";
import { BotaoVoltarIcone } from "@/components/v2/ui/voltar-icone";
import { MenuIndicadores } from "@/components/v2/indicadores/menu";
import { ReportDiarioSkeleton } from "@/components/v2/report-diario/report-diario-skeleton";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { papelDoUsuario } from "@/lib/central-de-links/papel";
import { loadEventosSeletor } from "@/lib/indicadores/seletor-eventos";
import { fetchReportDiario } from "@/lib/indicadores/service/report-diario";
import type { ReportDiarioMapa } from "@/lib/indicadores/report-diario-tipos";
import { ReportDiarioFunis } from "./report-diario-funis";

export const metadata: Metadata = { title: "Indicadores" };

export default async function IndicadoresV2Page() {
  const supabase = await createSupabaseServerClient();
  const resultado = await loadEventosSeletor(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const papelCentral = papelDoUsuario(user);

  // O Report é um resumo: se a leitura dos funis falhar, o menu segue sem ele.
  if (resultado.error !== undefined) console.error("v2/indicadores: leitura dos funis falhou", resultado.error);
  const ativos = resultado.error === undefined ? resultado.data.filters.filter((f) => f.status === "ativo") : [];

  // A promessa não é aguardada aqui: o carrossel a aguarda dentro do Suspense.
  // Sem funil ativo a seção inteira some, em vez de abrir a página com um bloco vazio.
  const relatorio: Promise<ReportDiarioMapa> | null =
    ativos.length === 0
      ? null
      : fetchReportDiario(ativos, createSupabaseServiceClient()).catch((error) => {
          console.error("v2/indicadores: report diário falhou", error);
          return {};
        });

  return (
    <div className="space-y-10">
      <BotaoVoltarIcone href="/v2" rotulo="Voltar ao menu" />
      {relatorio && (
        <Suspense fallback={<ReportDiarioSkeleton />}>
          <ReportDiarioFunis funis={ativos} mapa={relatorio} />
        </Suspense>
      )}
      <MenuIndicadores papelCentral={papelCentral} />
    </div>
  );
}
