import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  calculateAdsComercialMetrics,
  normalizeAdsComercialConfig,
} from "@/lib/convite/ads-comercial";
import type { ConviteAdsComercialConfig } from "@/types/convite";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: project, error: projectError } = await supabase
    .from("dash_gestao_convite_projetos")
    .select("id, grupo, data_inicio, data_fm")
    .eq("id", id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  if (project.grupo !== "funil_ads_comercial") {
    return NextResponse.json({ error: "Projeto não pertence ao Funil ADS Comercial" }, { status: 400 });
  }

  const { data: configRow, error: configError } = await supabase
    .from("dash_gestao_convite_funil_ads_comercial_projects")
    .select("*")
    .eq("convite_project_id", id)
    .maybeSingle();

  if (configError) {
    return NextResponse.json({ error: configError.message }, { status: 500 });
  }

  const config = normalizeAdsComercialConfig(configRow as Partial<ConviteAdsComercialConfig> | null);
  try {
    const metrics = await calculateAdsComercialMetrics(
      supabase,
      { id, data_inicio: project.data_inicio, data_fim: project.data_fm },
      config
    );

    return NextResponse.json({
      configured: !!config,
      metrics,
    });
  } catch (metricsError) {
    return NextResponse.json(
      {
        error: metricsError instanceof Error
          ? metricsError.message
          : "Erro ao calcular métricas do projeto",
      },
      { status: 500 }
    );
  }
}
