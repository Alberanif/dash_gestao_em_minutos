"use server";

import { revalidatePath } from "next/cache";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadContaPrincipal } from "@/lib/indicadores/seletor-eventos";
import { isEventId } from "@/lib/indicadores/event-id";
import {
  LIMITE_PASTAS,
  ehCorPasta,
  erroDoNomePasta,
  normalizarNomePasta,
  type CorPasta,
  type ResultadoAcao,
} from "@/components/v2/eventos/pastas-regras";
import { tabelaAusente } from "@/components/v2/eventos/pastas-servidor";

/**
 * Ações das pastas do usuário. Cada uma confere a sessão, descobre a conta e só mexe em linhas dessa conta;
 * as escritas usam o cliente de serviço, como o resto do Indicadores.
 */

const ROTA = "/v2/indicadores/eventos";
const FALHA = "Não foi possível salvar agora. Tente de novo.";
const SEM_TABELA = "As pastas ainda não estão disponíveis neste ambiente.";

type Contexto = { erro: string } | { erro?: undefined; accountId: string; db: ReturnType<typeof createSupabaseServiceClient> };

async function contexto(): Promise<Contexto> {
  const { error } = await validateApiAuth();
  if (error) return { erro: "Sua sessão não permite organizar pastas." };

  const conta = await loadContaPrincipal(await createSupabaseServerClient());
  if (conta.error !== undefined || conta.data === null) return { erro: FALHA };

  return { accountId: conta.data, db: createSupabaseServiceClient() };
}

function traduzir(erro: { code?: string; message?: string }): string {
  if (tabelaAusente(erro)) return SEM_TABELA;
  if (erro.code === "23505") return "Já existe uma pasta com esse nome.";
  console.error("v2/eventos: ação de pasta falhou", erro);
  return FALHA;
}

export async function criarPasta(nome: string, cor: CorPasta): Promise<ResultadoAcao<{ id: string }>> {
  const ctx = await contexto();
  if (ctx.erro !== undefined) return { ok: false, erro: ctx.erro };
  if (!ehCorPasta(cor)) return { ok: false, erro: "Escolha uma das cores." };

  const { accountId, db } = ctx;
  const existentes = await db.from("dash_gestao_event_folders").select("name").eq("account_id", accountId);
  if (existentes.error) return { ok: false, erro: traduzir(existentes.error) };
  const nomes = (existentes.data as { name: string }[]).map((f) => f.name);

  if (nomes.length >= LIMITE_PASTAS) return { ok: false, erro: `Limite de ${LIMITE_PASTAS} pastas atingido.` };
  const problema = erroDoNomePasta(nome, nomes);
  if (problema) return { ok: false, erro: problema };

  const { data, error } = await db
    .from("dash_gestao_event_folders")
    .insert({ account_id: accountId, name: normalizarNomePasta(nome), color: cor })
    .select("id")
    .single();
  if (error) return { ok: false, erro: traduzir(error) };

  revalidatePath(ROTA);
  return { ok: true, id: data.id as string };
}

export async function atualizarPasta(id: string, nome: string, cor: CorPasta): Promise<ResultadoAcao> {
  if (!isEventId(id)) return { ok: false, erro: FALHA };
  const ctx = await contexto();
  if (ctx.erro !== undefined) return { ok: false, erro: ctx.erro };
  if (!ehCorPasta(cor)) return { ok: false, erro: "Escolha uma das cores." };

  const { accountId, db } = ctx;
  const existentes = await db.from("dash_gestao_event_folders").select("id, name").eq("account_id", accountId);
  if (existentes.error) return { ok: false, erro: traduzir(existentes.error) };
  const todas = existentes.data as { id: string; name: string }[];
  if (!todas.some((f) => f.id === id)) return { ok: false, erro: "Essa pasta não existe mais." };

  const problema = erroDoNomePasta(
    nome,
    todas.filter((f) => f.id !== id).map((f) => f.name),
  );
  if (problema) return { ok: false, erro: problema };

  const { error } = await db
    .from("dash_gestao_event_folders")
    .update({ name: normalizarNomePasta(nome), color: cor, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("account_id", accountId);
  if (error) return { ok: false, erro: traduzir(error) };

  revalidatePath(ROTA);
  return { ok: true };
}

/** Excluir a pasta só desfaz o agrupamento: os eventos continuam onde estavam. */
export async function excluirPasta(id: string): Promise<ResultadoAcao> {
  if (!isEventId(id)) return { ok: false, erro: FALHA };
  const ctx = await contexto();
  if (ctx.erro !== undefined) return { ok: false, erro: ctx.erro };

  const { error } = await ctx.db
    .from("dash_gestao_event_folders")
    .delete()
    .eq("id", id)
    .eq("account_id", ctx.accountId);
  if (error) return { ok: false, erro: traduzir(error) };

  revalidatePath(ROTA);
  return { ok: true };
}

/** Define em quais pastas do usuário o evento está (substitui o conjunto anterior). */
export async function definirPastasDoEvento(eventoId: string, pastaIds: string[]): Promise<ResultadoAcao> {
  if (!isEventId(eventoId) || !Array.isArray(pastaIds) || !pastaIds.every(isEventId)) return { ok: false, erro: FALHA };
  const ctx = await contexto();
  if (ctx.erro !== undefined) return { ok: false, erro: ctx.erro };

  const { accountId, db } = ctx;
  const evento = await db.from("dash_gestao_filters").select("id").eq("id", eventoId).eq("account_id", accountId);
  if (evento.error) return { ok: false, erro: traduzir(evento.error) };
  if ((evento.data ?? []).length === 0) return { ok: false, erro: "Esse evento não existe mais." };

  const pastas = await db.from("dash_gestao_event_folders").select("id").eq("account_id", accountId);
  if (pastas.error) return { ok: false, erro: traduzir(pastas.error) };
  const daConta = new Set((pastas.data as { id: string }[]).map((p) => p.id));
  const alvo = [...new Set(pastaIds)];
  if (!alvo.every((p) => daConta.has(p))) return { ok: false, erro: "Essa pasta não existe mais." };

  const limpar = await db
    .from("dash_gestao_event_folder_items")
    .delete()
    .eq("filter_id", eventoId)
    .in("folder_id", [...daConta]);
  if (limpar.error) return { ok: false, erro: traduzir(limpar.error) };

  if (alvo.length > 0) {
    const incluir = await db
      .from("dash_gestao_event_folder_items")
      .insert(alvo.map((folder_id) => ({ folder_id, filter_id: eventoId })));
    if (incluir.error) return { ok: false, erro: traduzir(incluir.error) };
  }

  revalidatePath(ROTA);
  return { ok: true };
}
