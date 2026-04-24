import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  calculateAdsComercialMetrics,
  normalizeAdsComercialConfig,
} from "@/lib/convite/ads-comercial";
import {
  CONVITE_GROUP_OPTIONS,
  type ConviteAdsComercialConfig,
  type ConviteFunilDestraveMetrics,
  type ConviteGroup,
  type ConviteProject,
  type ConviteUltimateMetrics,
} from "@/types/convite";

interface ConviteProjectRow {
  id: string;
  grupo: ConviteGroup;
  nome_projeto: string;
  data_inicio: string;
  data_fm: string;
}

interface UltimateMonthlyRow {
  id: string;
  projeto: string;
  month_year: string;
  numero_absoluto: number;
}

interface UltimatePercRow {
  id: string;
  projeto: string;
  perc_renovacao: number;
  perc_conv_pitch: number;
}

const ALLOWED_GROUPS = new Set<ConviteGroup>(CONVITE_GROUP_OPTIONS.map((option) => option.value));

function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function mapProject(
  row: ConviteProjectRow,
  metrics: ConviteProject["metrics"],
  adsComercialConfig: ConviteAdsComercialConfig | null
): ConviteProject {
  return {
    id: row.id,
    grupo: row.grupo,
    nome_projeto: row.nome_projeto,
    data_inicio: row.data_inicio,
    data_fim: row.data_fm,
    metrics,
    ads_comercial_config: adsComercialConfig,
  };
}

function parseDateInput(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const groupParam = request.nextUrl.searchParams.get("group");
  const group = groupParam && ALLOWED_GROUPS.has(groupParam as ConviteGroup)
    ? (groupParam as ConviteGroup)
    : null;

  if (groupParam && !group) {
    return NextResponse.json({ error: "Grupo não suportado" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const projectsQuery = supabase
    .from("dash_gestao_convite_projetos")
    .select("id, grupo, nome_projeto, data_inicio, data_fm")
    .order("data_inicio", { ascending: true });

  if (group) {
    projectsQuery.eq("grupo", group);
  }

  const [
    { data: projectRows, error: projectsError },
    { data: metricRows, error: metricsError },
    { data: adsConfigRows, error: adsConfigError },
    { data: ultimateRows, error: ultimateError },
    { data: ultimatePercRows, error: ultimatePercError },
  ] = await Promise.all([
    projectsQuery,
    group === "funil_destrave" || group === null
      ? supabase
          .from("dash_gestao_convite_funil_destrave")
          .select("*")
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    group === "funil_ads_comercial" || group === null
      ? supabase
          .from("dash_gestao_convite_funil_ads_comercial_projects")
          .select("*")
      : Promise.resolve({ data: [], error: null }),
    group === "ultimate" || group === null
      ? supabase
          .from("dash_gestao_convite_ultimate")
          .select("id, projeto, month_year, numero_absoluto")
          .order("month_year", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    group === "ultimate" || group === null
      ? supabase
          .from("dash_gestao_convite_ultimate_percentuais")
          .select("id, projeto, perc_renovacao, perc_conv_pitch")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 });
  if (metricsError) return NextResponse.json({ error: metricsError.message }, { status: 500 });
  if (adsConfigError) return NextResponse.json({ error: adsConfigError.message }, { status: 500 });
  if (ultimateError) return NextResponse.json({ error: ultimateError.message }, { status: 500 });
  if (ultimatePercError) return NextResponse.json({ error: ultimatePercError.message }, { status: 500 });

  // Funil Destrave: latest metric by project name
  const latestMetricsByProject = new Map<string, ConviteFunilDestraveMetrics>();
  for (const row of (metricRows ?? []) as ConviteFunilDestraveMetrics[]) {
    const key = normalizeProjectName(row.projeto);
    if (!latestMetricsByProject.has(key)) {
      latestMetricsByProject.set(key, row);
    }
  }

  // ADS Comercial: config by project id
  const adsConfigByProject = new Map<string, ConviteAdsComercialConfig>();
  for (const row of (adsConfigRows ?? []) as Partial<ConviteAdsComercialConfig>[]) {
    const config = normalizeAdsComercialConfig(row);
    if (config) {
      adsConfigByProject.set(config.convite_project_id, config);
    }
  }

  // Ultimate: group monthly rows by normalized project name
  const ultimateMonthlyByProject = new Map<string, UltimateMonthlyRow[]>();
  for (const row of (ultimateRows ?? []) as UltimateMonthlyRow[]) {
    const key = normalizeProjectName(row.projeto);
    if (!ultimateMonthlyByProject.has(key)) {
      ultimateMonthlyByProject.set(key, []);
    }
    ultimateMonthlyByProject.get(key)!.push(row);
  }

  // Ultimate: group percentuais rows by normalized project name
  const ultimatePercByProject = new Map<string, UltimatePercRow[]>();
  for (const row of (ultimatePercRows ?? []) as UltimatePercRow[]) {
    const key = normalizeProjectName(row.projeto);
    if (!ultimatePercByProject.has(key)) {
      ultimatePercByProject.set(key, []);
    }
    ultimatePercByProject.get(key)!.push(row);
  }

  // Build ConviteUltimateMetrics per project id
  const ultimateMetricsByProjectId = new Map<string, ConviteUltimateMetrics>();
  for (const row of (projectRows ?? []) as ConviteProjectRow[]) {
    if (row.grupo !== "ultimate") continue;
    const key = normalizeProjectName(row.nome_projeto);
    const monthly = ultimateMonthlyByProject.get(key) ?? [];
    const percs = ultimatePercByProject.get(key) ?? [];
    if (monthly.length === 0 && percs.length === 0) continue;
    const latestMonthly = monthly[0];
    const latestPerc = percs[0];
    ultimateMetricsByProjectId.set(row.id, {
      latest_month_year: latestMonthly?.month_year ?? "",
      latest_numero_absoluto: latestMonthly?.numero_absoluto ?? 0,
      latest_perc_renovacao: latestPerc?.perc_renovacao ?? null,
      latest_perc_conv_pitch: latestPerc?.perc_conv_pitch ?? null,
      monthly_history: monthly.map((r) => ({
        id: r.id,
        month_year: r.month_year,
        numero_absoluto: r.numero_absoluto,
      })),
      percentuais_history: percs.map((r) => ({
        id: r.id,
        projeto: r.projeto,
        perc_renovacao: r.perc_renovacao,
        perc_conv_pitch: r.perc_conv_pitch,
      })),
    });
  }

  const rows = (projectRows ?? []) as ConviteProjectRow[];
  let adsMetricsEntries: ReadonlyArray<readonly [string, ConviteProject["metrics"]]>;
  try {
    adsMetricsEntries = await Promise.all(
      rows
        .filter((row) => row.grupo === "funil_ads_comercial")
        .map(async (row) => {
          const config = adsConfigByProject.get(row.id) ?? null;
          const metrics = await calculateAdsComercialMetrics(
            supabase,
            { id: row.id, data_inicio: row.data_inicio, data_fim: row.data_fm },
            config
          );
          return [row.id, metrics] as const;
        })
    );
  } catch (metricsBuildError) {
    return NextResponse.json(
      {
        error: metricsBuildError instanceof Error
          ? metricsBuildError.message
          : "Erro ao calcular métricas do ADS Comercial",
      },
      { status: 500 }
    );
  }
  const adsMetricsByProject = new Map(adsMetricsEntries);

  const projects = rows.map((row) =>
    mapProject(
      row,
      row.grupo === "funil_destrave"
        ? latestMetricsByProject.get(normalizeProjectName(row.nome_projeto)) ?? null
        : row.grupo === "funil_ads_comercial"
        ? adsMetricsByProject.get(row.id) ?? null
        : row.grupo === "ultimate"
        ? ultimateMetricsByProjectId.get(row.id) ?? null
        : null,
      row.grupo === "funil_ads_comercial" ? adsConfigByProject.get(row.id) ?? null : null
    )
  );

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const group = typeof body.grupo === "string" ? body.grupo : "";
  const nomeProjeto = typeof body.nome_projeto === "string" ? body.nome_projeto.trim() : "";
  const dataInicioRaw = typeof body.data_inicio === "string" ? body.data_inicio : "";
  const dataFimRaw = typeof body.data_fim === "string" ? body.data_fim : "";

  if (!ALLOWED_GROUPS.has(group as ConviteGroup)) {
    return NextResponse.json({ error: "grupo é obrigatório" }, { status: 400 });
  }
  if (!nomeProjeto) {
    return NextResponse.json({ error: "nome_projeto é obrigatório" }, { status: 400 });
  }
  if (!dataInicioRaw || !dataFimRaw) {
    return NextResponse.json({ error: "data_inicio e data_fim são obrigatórios" }, { status: 400 });
  }
  if (dataFimRaw <= dataInicioRaw) {
    return NextResponse.json(
      { error: "A data de fim deve ser posterior à data de início" },
      { status: 400 }
    );
  }

  const dataInicio = parseDateInput(dataInicioRaw);
  const dataFim = parseDateInput(dataFimRaw);
  if (!dataInicio || !dataFim) {
    return NextResponse.json({ error: "Formato de data inválido" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: existingRows, error: existingError } = await supabase
    .from("dash_gestao_convite_projetos")
    .select("id, grupo, nome_projeto");

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const normalizedName = normalizeProjectName(nomeProjeto);
  const hasDuplicate = (existingRows ?? []).some(
    (row) =>
      String(row.grupo ?? "") === group &&
      normalizeProjectName(String(row.nome_projeto ?? "")) === normalizedName
  );

  if (hasDuplicate) {
    return NextResponse.json(
      { error: "Já existe um projeto de Convite com esse nome" },
      { status: 409 }
    );
  }

  const { data, error: insertError } = await supabase
    .from("dash_gestao_convite_projetos")
    .insert({
      grupo: group,
      nome_projeto: nomeProjeto,
      data_inicio: dataInicio,
      data_fm: dataFim,
    })
    .select("id, grupo, nome_projeto, data_inicio, data_fm")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(mapProject(data as ConviteProjectRow, null, null), { status: 201 });
}
