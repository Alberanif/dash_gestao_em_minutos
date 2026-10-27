import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { exigirPapelCentral } from "@/lib/central-de-links/papel-servidor";
import { compararVariantes } from "@/lib/central-de-links/estatistica";

/**
 * Resultado de um Teste A/B (membro e admin leem).
 * GET ?teste=<uuid>[&utm_source=&utm_medium=&utm_campaign=&dispositivo=&pais=]
 * A agregação é feita no banco (função ab_resumo, que já exclui robôs), por causa do limite de
 * 1.000 linhas do PostgREST. Porte de api/ab-resultado.js: o JSON é idêntico ao original.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILTROS = ["utm_source", "utm_medium", "utm_campaign", "dispositivo", "pais"] as const;
const HORAS_SEM_EVENTO = 6; // acima disso a instalação é considerada com problema

type Filtro = (typeof FILTROS)[number];
type Linha = Record<string, unknown>;

type Resumo = {
  totais?: Linha[];
  serie?: Linha[];
  cortes?: Linha[];
  ultimos?: Linha[];
  filtros?: Partial<Record<Filtro, unknown[]>>;
};

type Variante = {
  id: string;
  rotulo: string;
  controle: boolean;
  link_id: string;
  central_links: { label: string; url: string } | null;
};

const CABECALHOS = { "Cache-Control": "no-store" };

function responder(corpo: unknown, status = 200) {
  return NextResponse.json(corpo, { status, headers: CABECALHOS });
}

class ErroHttp extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** Desembrulha { data, error } do supabase-js; qualquer falha do banco vira 502. */
function dados<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw new ErroHttp(502, "Falha ao consultar o banco.");
  return r.data;
}

const taxa = (leads: number, visitantes: number) => (visitantes > 0 ? leads / visitantes : 0);
const num = (v: unknown) => Number(v) || 0;

function agrupar(lista: Linha[] | undefined, chave: string) {
  const m: Record<string, Linha[]> = {};
  for (const x of lista ?? []) (m[String(x[chave])] ??= []).push(x);
  return m;
}

export async function GET(request: NextRequest) {
  try {
    const { error } = await exigirPapelCentral("membro");
    if (error) return error;

    const params = request.nextUrl.searchParams;
    const teste = params.get("teste") ?? "";
    if (!UUID.test(teste)) return responder({ erro: "Teste inválido." }, 400);

    const filtros: Partial<Record<Filtro, string>> = {};
    for (const f of FILTROS) {
      const todos = params.getAll(f);
      if (todos.length === 0 || (todos.length === 1 && todos[0] === "")) continue;
      if (todos.length > 1 || todos[0].length > 200) {
        return responder({ erro: "Filtro inválido: " + f + "." }, 400);
      }
      filtros[f] = todos[0];
    }

    const sb = createSupabaseServiceClient();

    const testes = dados(
      await sb
        .from("ab_testes")
        .select("id,nome,status,iniciado_em,encerrado_em,vencedor_variante,anotacao")
        .eq("id", teste),
    );
    if (!testes || testes.length === 0) return responder({ erro: "Teste não encontrado." }, 404);
    const t = testes[0] as unknown as {
      status: string;
      iniciado_em: string | null;
    } & Linha;

    const variantes = (dados(
      await sb
        .from("ab_variantes")
        .select("id,rotulo,controle,link_id,central_links(label,url)")
        .eq("teste_id", teste)
        .order("rotulo", { ascending: true }),
    ) ?? []) as unknown as Variante[];

    const resumo: Resumo = t.iniciado_em
      ? ((dados(
          await sb.rpc("ab_resumo", {
            p_teste: teste,
            p_utm_source: filtros.utm_source || null,
            p_utm_medium: filtros.utm_medium || null,
            p_utm_campaign: filtros.utm_campaign || null,
            p_dispositivo: filtros.dispositivo || null,
            p_pais: filtros.pais || null,
          }),
        ) ?? {}) as Resumo)
      : { totais: [], serie: [], cortes: [], ultimos: [], filtros: {} };

    const totais: Record<string, Linha> = {};
    for (const x of resumo.totais ?? []) totais[String(x.variante_id)] = x;
    const series = agrupar(resumo.serie, "variante_id");
    const cortes = agrupar(resumo.cortes, "variante_id");
    const ultimos: Record<string, unknown> = {};
    for (const x of resumo.ultimos ?? []) ultimos[String(x.link_id)] = x.ultimo;

    const base = variantes.map((v) => {
      const x = totais[v.id] ?? {};
      return { id: v.id, controle: v.controle, visitantes: num(x.unicos), leads: num(x.leads) };
    });
    const est = compararVariantes(base);
    const estPorId: Record<string, (typeof est.variantes)[number]> = {};
    for (const e of est.variantes) estPorId[e.id] = e;

    const agora = Date.now();
    const saida = variantes.map((v) => {
      const x = totais[v.id] ?? {};
      const unicos = num(x.unicos);
      const novos = num(x.novos);
      const leads = num(x.leads);
      const e: Partial<(typeof est.variantes)[number]> = estPorId[v.id] ?? {};
      const ultimo = (ultimos[v.link_id] as string | null | undefined) ?? null;
      const horas = ultimo ? (agora - new Date(ultimo).getTime()) / 36e5 : null;
      return {
        id: v.id,
        rotulo: v.rotulo,
        controle: v.controle,
        link_id: v.link_id,
        pagina: v.central_links ? v.central_links.label : null,
        url: v.central_links ? v.central_links.url : null,
        visualizacoes: num(x.visualizacoes),
        unicos,
        novos,
        recorrentes: Math.max(unicos - novos, 0),
        leads,
        envios: num(x.envios),
        conversao: taxa(leads, unicos),
        funil: { visitaram: unicos, comecaram: num(x.comecaram), enviaram: leads },
        estatistica: {
          diferenca_abs: e.diferenca_abs ?? null,
          diferenca_rel: e.diferenca_rel ?? null,
          p_valor: e.p_valor ?? null,
          confianca: e.confianca ?? null,
          faltam: e.faltam ?? null,
          veredito: e.veredito || null,
        },
        serie: (series[v.id] ?? []).map((d) => ({
          dia: d.dia,
          visitantes: num(d.visitantes),
          leads: num(d.leads),
          conversao: taxa(num(d.leads), num(d.visitantes)),
        })),
        cortes: (cortes[v.id] ?? []).map((c) => ({
          dimensao: c.dimensao,
          valor: c.valor,
          visitantes: num(c.visitantes),
          leads: num(c.leads),
          conversao: taxa(num(c.leads), num(c.visitantes)),
        })),
        saude: {
          ultimo_evento: ultimo,
          horas_sem_evento: horas == null ? null : Math.round(horas * 10) / 10,
          alerta: t.status === "ativo" && (horas == null || horas > HORAS_SEM_EVENTO),
        },
      };
    });

    const fd = resumo.filtros ?? {};
    return responder({
      teste: t,
      filtros_aplicados: filtros,
      filtros_disponiveis: {
        utm_source: fd.utm_source ?? [],
        utm_medium: fd.utm_medium ?? [],
        utm_campaign: fd.utm_campaign ?? [],
        dispositivo: fd.dispositivo ?? [],
        pais: fd.pais ?? [],
      },
      veredito: {
        resultado: est.veredito,
        vencedor_id: est.vencedor_id,
        avisos: est.avisos,
        confianca_minima: est.confianca_minima,
        amostra_minima: est.amostra_minima,
        controle_id: est.controle_id,
      },
      horas_sem_evento_alerta: HORAS_SEM_EVENTO,
      variantes: saida,
    });
  } catch (e) {
    if (e instanceof ErroHttp) return responder({ erro: e.message }, e.status);
    console.error("ab-resultado:", e);
    return responder({ erro: "Erro interno." }, 500);
  }
}
