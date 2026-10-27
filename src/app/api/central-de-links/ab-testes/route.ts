import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { exigirPapelCentral } from "@/lib/central-de-links/papel-servidor";
import {
  ErroDeRegra,
  MSG_ENCERRAMENTO_CONCORRENTE,
  MSG_INICIO_CONCORRENTE,
  checarEdicao,
  checarExclusao,
  checarInicio,
  conferirLinks,
  erroDoBanco,
  montarEncerramento,
  validarDados,
  validarIdTeste,
  type LinhaDeLink,
  type TesteParaRegra,
} from "@/lib/central-de-links/ab-testes";

/**
 * Administração dos testes A/B: listar, criar, editar, iniciar, encerrar, excluir.
 * POST { acao, ... } (GET = listar). `listar`: membro ou admin. As demais: só admin.
 * O papel é reconsultado a cada chamada (exigirPapelCentral). Toda regra é validada aqui, com a
 * service key; o RLS é a segunda barreira, não a primeira. Porte de api/ab-testes.js.
 */

type Cliente = ReturnType<typeof createSupabaseServiceClient>;
type Corpo = Record<string, unknown>;
type Teste = TesteParaRegra & Record<string, unknown>;

const SELECAO =
  "*,ab_variantes!ab_variantes_teste_id_fkey(id,link_id,rotulo,controle,central_links(label,url,tipo,deleted))";

const CABECALHOS = { "Cache-Control": "no-store" };

function responder(corpo: unknown, status = 200) {
  return NextResponse.json(corpo, { status, headers: CABECALHOS });
}

/** Desembrulha { data, error } do supabase-js; erro do banco vira ErroDeRegra (23505 -> 409). */
function dados<T>(r: { data: T; error: { code?: string; message?: string } | null }): T {
  if (r.error) throw erroDoBanco(r.error);
  return r.data;
}

async function buscarTeste(sb: Cliente, id: unknown): Promise<Teste> {
  const uuid = validarIdTeste(id);
  const linha = dados(await sb.from("ab_testes").select(SELECAO).eq("id", uuid).maybeSingle());
  if (!linha) throw new ErroDeRegra(404, "Teste não encontrado.");
  return linha as unknown as Teste;
}

async function verificarLinks(sb: Cliente, ids: string[]) {
  const linhas = dados(await sb.from("central_links").select("id,label,tipo,deleted").in("id", ids));
  conferirLinks(ids, linhas as unknown as LinhaDeLink[]);
}

async function listar(sb: Cliente) {
  const testes = dados(await sb.from("ab_testes").select(SELECAO).order("created_at", { ascending: false }));
  return { testes: testes ?? [] };
}

async function criar(sb: Cliente, corpo: Corpo) {
  const d = validarDados(corpo);
  await verificarLinks(sb, d.variantes.map((v) => v.link_id));
  const teste = dados(await sb.from("ab_testes").insert({ nome: d.nome }).select().single());
  try {
    dados(await sb.from("ab_variantes").insert(d.variantes.map((v) => ({ ...v, teste_id: teste.id }))));
  } catch (e) {
    // não deixa um teste vazio para trás
    await Promise.resolve(sb.from("ab_testes").delete().eq("id", teste.id)).catch(() => {});
    throw e;
  }
  return { teste: await buscarTeste(sb, teste.id) };
}

async function editar(sb: Cliente, corpo: Corpo) {
  const atual = await buscarTeste(sb, corpo.id);
  checarEdicao(atual);
  const d = validarDados(corpo);
  await verificarLinks(sb, d.variantes.map((v) => v.link_id));

  const antigas = (atual.ab_variantes ?? []).map((v) => {
    const x = v as unknown as { id: string; link_id: string; rotulo: string; controle: boolean };
    return { id: x.id, teste_id: atual.id, link_id: x.link_id, rotulo: x.rotulo, controle: x.controle };
  });
  dados(await sb.from("ab_variantes").delete().eq("teste_id", atual.id));
  try {
    dados(await sb.from("ab_variantes").insert(d.variantes.map((v) => ({ ...v, teste_id: atual.id }))));
  } catch (e) {
    // devolve as variantes anteriores para não deixar o teste vazio
    if (antigas.length) await Promise.resolve(sb.from("ab_variantes").insert(antigas)).catch(() => {});
    throw e;
  }
  dados(await sb.from("ab_testes").update({ nome: d.nome }).eq("id", atual.id));
  return { teste: await buscarTeste(sb, atual.id) };
}

async function iniciar(sb: Cliente, corpo: Corpo) {
  const teste = await buscarTeste(sb, corpo.id);
  checarInicio(teste);
  await verificarLinks(sb, (teste.ab_variantes ?? []).map((v) => v.link_id));

  // o filtro por status evita iniciar duas vezes em chamadas simultâneas;
  // o gatilho do banco recusa páginas que já estão em outro teste ativo (23505 -> 409)
  const r = dados(
    await sb
      .from("ab_testes")
      .update({ status: "ativo", iniciado_em: new Date().toISOString() })
      .eq("id", teste.id)
      .eq("status", "rascunho")
      .select("id"),
  );
  if (!r || r.length === 0) throw new ErroDeRegra(409, MSG_INICIO_CONCORRENTE);
  return { teste: await buscarTeste(sb, teste.id) };
}

async function encerrar(sb: Cliente, corpo: Corpo) {
  const teste = await buscarTeste(sb, corpo.id);
  const campos = montarEncerramento(teste, corpo);
  const r = dados(
    await sb.from("ab_testes").update(campos).eq("id", teste.id).eq("status", "ativo").select("id"),
  );
  if (!r || r.length === 0) throw new ErroDeRegra(409, MSG_ENCERRAMENTO_CONCORRENTE);
  return { teste: await buscarTeste(sb, teste.id) };
}

async function excluir(sb: Cliente, corpo: Corpo) {
  const teste = await buscarTeste(sb, corpo.id);
  checarExclusao(teste, corpo);
  // as variantes e os eventos saem junto (on delete cascade)
  dados(await sb.from("ab_testes").delete().eq("id", teste.id));
  return { ok: true };
}

const ACOES: Record<string, (sb: Cliente, corpo: Corpo) => Promise<unknown>> = {
  criar,
  editar,
  iniciar,
  encerrar,
  excluir,
};

async function tratar(acao: string, corpo: Corpo) {
  try {
    if (acao === "listar") {
      const { error } = await exigirPapelCentral("membro");
      if (error) return error;
      return responder(await listar(createSupabaseServiceClient()));
    }
    if (!Object.prototype.hasOwnProperty.call(ACOES, acao)) {
      throw new ErroDeRegra(400, "Ação desconhecida.");
    }
    const { error } = await exigirPapelCentral("admin");
    if (error) return error;
    return responder(await ACOES[acao](createSupabaseServiceClient(), corpo));
  } catch (e) {
    if (e instanceof ErroDeRegra) return responder({ erro: e.mensagem }, e.status);
    console.error("ab-testes:", e);
    return responder({ erro: "Erro interno." }, 500);
  }
}

export async function GET() {
  return tratar("listar", {});
}

export async function POST(request: NextRequest) {
  let corpo: unknown = null;
  try {
    corpo = await request.json();
  } catch {
    corpo = null;
  }
  if (!corpo || typeof corpo !== "object") {
    return responder({ erro: "Corpo da requisição inválido." }, 400);
  }
  const c = corpo as Corpo;
  return tratar(String(c.acao ?? ""), c);
}
