import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { classificarDispositivo, ehRobo, navegador, normalizarUrl } from "@/lib/central-de-links/ab";
import {
  LIMITE_IP,
  LIMITE_VISITANTE,
  MAX_CORPO,
  type LinhaVariante,
  estourou,
  hostDe,
  validar,
  variantesAtivas,
} from "./coleta";

/**
 * Coleta pública do Teste A/B, chamada pelo snippet public/t.js das páginas de captura.
 * Sem login: por isso só grava para páginas de testes ATIVOS, valida tudo, limita a taxa e nunca
 * devolve dados (204 sempre que o corpo é válido, mesmo quando o evento é descartado).
 * Teste e variante vêm do servidor (pela URL), nunca do cliente. Não grava IP.
 * A cópia arquivada (/p/…) da própria Central não casa com nenhum `central_links.url`, então cai
 * no descarte por "página sem teste ativo". Robôs são gravados, marcados com `robo`.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*", // coleta pública; nunca devolve dados nem usa cookies
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

function fim(status: number) {
  return new Response(null, { status, headers: CORS });
}

async function buscarVariantes(): Promise<LinhaVariante[]> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("ab_variantes")
    .select(
      "id,teste_id,link_id,central_links!inner(url,deleted),ab_testes!ab_variantes_teste_id_fkey!inner(status,iniciado_em)",
    )
    .eq("ab_testes.status", "ativo")
    .eq("central_links.deleted", false)
    .limit(1000);
  if (error) throw new Error("consulta falhou");
  return (data ?? []) as unknown as LinhaVariante[];
}

export async function OPTIONS() {
  return fim(204);
}

export async function POST(request: NextRequest) {
  try {
    const declarado = parseInt(request.headers.get("content-length") ?? "", 10);
    if (declarado > MAX_CORPO) return fim(413);

    let texto: string;
    try {
      texto = await request.text();
    } catch {
      return fim(400);
    }
    if (texto.length > MAX_CORPO) return fim(413);
    let bruto: unknown;
    try {
      bruto = JSON.parse(texto);
    } catch {
      return fim(400);
    }
    const ev = validar(bruto);
    if (!ev) return fim(400);

    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sem-ip";
    if (estourou("v:" + ev.visitante_id, LIMITE_VISITANTE) || estourou("i:" + ip, LIMITE_IP)) return fim(429);

    // a partir daqui, qualquer descarte responde 204 (não revela o motivo)
    const ua = request.headers.get("user-agent") ?? "";
    const normal = normalizarUrl(ev.url);
    if (!normal) return fim(204);

    let achada;
    try {
      achada = (await variantesAtivas(buscarVariantes)).find((v) => v.url === normal);
    } catch {
      return fim(204);
    }
    if (!achada) return fim(204);

    const agora = Date.now();
    if (achada.iniciado_em && agora < achada.iniciado_em) return fim(204);

    let referrerHost = ev.referrer ? hostDe(ev.referrer) : null;
    if (referrerHost && referrerHost === normal.split("/")[0]) referrerHost = null;
    const pais = (request.headers.get("x-vercel-ip-country") ?? "").toUpperCase();

    const linha = {
      evento_id: ev.evento_id,
      teste_id: achada.teste_id,
      variante_id: achada.variante_id,
      link_id: achada.link_id,
      visitante_id: ev.visitante_id,
      tipo: ev.tipo,
      ocorreu_em: new Date(agora).toISOString(),
      novo_visitante: ev.novo_visitante,
      utm_source: ev.utm_source,
      utm_medium: ev.utm_medium,
      utm_campaign: ev.utm_campaign,
      utm_content: ev.utm_content,
      utm_term: ev.utm_term,
      referrer_host: referrerHost ? referrerHost.slice(0, 200) : null,
      dispositivo: classificarDispositivo(ua),
      navegador: navegador(ua),
      pais: /^[A-Z]{2}$/.test(pais) ? pais : null,
      robo: ehRobo(ua),
    };

    const { error } = await createSupabaseServiceClient()
      .from("ab_eventos")
      .upsert(linha, { onConflict: "evento_id", ignoreDuplicates: true });
    return fim(error ? 502 : 204);
  } catch {
    return fim(500);
  }
}
