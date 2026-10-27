import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  FILTER_STATUSES,
  type DebriefingProduct,
  type FilterRecord,
  type FilterStatus,
} from "@/types/indicadores";
import { validateDebriefingProducts } from "@/lib/indicadores/debriefing-products";
import { validateOrganicSources } from "@/lib/indicadores/organic-validation";
import { validateEventPeriod } from "@/lib/indicadores/event-period";
import { aplicarStatusAutomatico, eventoVencido } from "@/lib/indicadores/status-automatico";

type Params = { id: string };

export async function PUT(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const {
    name,
    hotmart_products,
    main_hotmart_product,
    debriefing_offer_codes,
    debriefing_products,
    meta_ads_terms,
    captacao_leads_eventos,
    is_organic,
    status,
    start_date,
    end_date,
  } = body ?? {};

  // Período só entra no update quando o corpo traz alguma das datas; vazio nos dois limpa o período.
  const periodo = validateEventPeriod(start_date, end_date);
  if (!periodo.ok && (start_date !== undefined || end_date !== undefined)) {
    return NextResponse.json({ error: periodo.error }, { status: 400 });
  }

  let debriefingProductsValue: DebriefingProduct[] | null | undefined;
  if (debriefing_products !== undefined) {
    const validation = validateDebriefingProducts(debriefing_products);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    debriefingProductsValue = validation.value;
  }

  if (status !== undefined && !FILTER_STATUSES.includes(status as FilterStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${FILTER_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  if (is_organic !== undefined && typeof is_organic !== "boolean") {
    return NextResponse.json({ error: "is_organic must be a boolean" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // Uma unica leitura da linha atual, reaproveitada pela validacao organica e
  // pela deteccao de mudanca de status.
  type CurrentRow = {
    status?: string;
    end_date?: string | null;
    is_organic?: boolean;
    meta_ads_terms?: unknown[];
    captacao_leads_eventos?: unknown[];
  };
  let currentCache: Promise<CurrentRow | null> | null = null;
  const getCurrent = () => {
    currentCache ??= (async () => {
      const { data } = await supabase
        .from("dash_gestao_filters")
        .select("status, end_date, is_organic, meta_ads_terms, captacao_leads_eventos")
        .eq("id", id)
        .single();
      return data as CurrentRow | null;
    })();
    return currentCache;
  };

  // Validacao organica considera o estado resultante (payload + linha atual),
  // pois o PUT e parcial. So busca a linha quando o resultado depende dela.
  const touchesOrganicSources = meta_ads_terms !== undefined || captacao_leads_eventos !== undefined;
  if (is_organic === true || (is_organic === undefined && touchesOrganicSources)) {
    const needsCurrent =
      is_organic === undefined || meta_ads_terms === undefined || captacao_leads_eventos === undefined;
    const currentRow = needsCurrent ? await getCurrent() : null;
    const effectiveOrganic = is_organic ?? currentRow?.is_organic === true;
    if (effectiveOrganic) {
      const organicError = validateOrganicSources(
        meta_ads_terms !== undefined ? meta_ads_terms : currentRow?.meta_ads_terms,
        captacao_leads_eventos !== undefined ? captacao_leads_eventos : currentRow?.captacao_leads_eventos
      );
      if (organicError) {
        return NextResponse.json({ error: organicError }, { status: 400 });
      }
    }
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) update.name = name;
  if (hotmart_products !== undefined) update.hotmart_products = hotmart_products;
  if (meta_ads_terms !== undefined) update.meta_ads_terms = meta_ads_terms;
  if (captacao_leads_eventos !== undefined) update.captacao_leads_eventos = captacao_leads_eventos;
  if (is_organic !== undefined) update.is_organic = is_organic;
  if (main_hotmart_product !== undefined) update.main_hotmart_product = main_hotmart_product;
  if (debriefing_offer_codes !== undefined) update.debriefing_offer_codes = debriefing_offer_codes;
  if (debriefingProductsValue !== undefined) update.debriefing_products = debriefingProductsValue;
  if (periodo.ok && (start_date !== undefined || end_date !== undefined)) {
    update.start_date = periodo.value.start_date;
    update.end_date = periodo.value.end_date;
  }

  if (status !== undefined) {
    const current = await getCurrent();

    // A data de fim manda: com ela vencida, só "cancelado" é gravado. Ativo/finalizado ficam
    // como estão no banco, que a leitura resolve (e a edição não carimba a data da mudança).
    const fimResultante = periodo.ok && (start_date !== undefined || end_date !== undefined)
      ? periodo.value.end_date
      : current?.end_date;
    const vencido = eventoVencido(fimResultante);

    if (status === "cancelado" || !vencido) {
      update.status = status;
      if (current && current.status !== status) {
        update.status_changed_at = new Date().toISOString();
      }
    }
  }

  const { data, error: dbError } = await supabase
    .from("dash_gestao_filters")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (dbError) {
    if (dbError.code === "PGRST116") {
      return NextResponse.json({ error: "Filter not found" }, { status: 404 });
    }
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Filter not found" }, { status: 404 });
  }

  return NextResponse.json(aplicarStatusAutomatico(data as FilterRecord));
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();
  const { error: dbError } = await supabase
    .from("dash_gestao_filters")
    .delete()
    .eq("id", id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
