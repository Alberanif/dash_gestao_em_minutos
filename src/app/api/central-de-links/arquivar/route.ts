import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { exigirPapelCentral } from "@/lib/central-de-links/papel-servidor";
import { statusDaPagina } from "@/lib/central-de-links/ssrf";
import { capturar, capturarMiniatura, localizarNavegador } from "@/lib/central-de-links/captura";
import {
  FalhaDeArquivamento,
  TRAVA_OBSOLETA_MS,
  limitarMensagem,
  statusAposFalha,
  validarCaptura,
} from "@/lib/central-de-links/arquivamento";

export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "paginas";

/**
 * Arquiva a página de um link (cópia fiel, estilo SingleFile) no bucket "paginas".
 * Só admin da Central. A URL vem do banco, nunca do corpo. A cópia nasce privada:
 * esta rota jamais liga `pagina_ativa`.
 */
export async function POST(request: NextRequest) {
  const { error } = await exigirPapelCentral("admin");
  if (error) return error;

  let corpo: { id?: unknown } | null = null;
  try {
    corpo = await request.json();
  } catch {
    corpo = null;
  }
  const id = corpo?.id;
  if (typeof id !== "string" || !UUID.test(id)) {
    return NextResponse.json({ erro: "Identificador inválido." }, { status: 400 });
  }

  const sb = createSupabaseServiceClient();

  const { data: link, error: erroLeitura } = await sb
    .from("central_links")
    .select("id,url,arquivo_path,arquivo_tam")
    .eq("deleted", false)
    .eq("id", id)
    .maybeSingle();
  if (erroLeitura) return NextResponse.json({ erro: "Erro ao consultar o banco." }, { status: 500 });
  if (!link) return NextResponse.json({ erro: "Link não encontrado." }, { status: 404 });

  // Uma captura por vez por link: só assume se não estiver arquivando (ou se a tentativa morreu).
  const obsoleta = new Date(Date.now() - TRAVA_OBSOLETA_MS).toISOString();
  const { data: tomado, error: erroTrava } = await sb
    .from("central_links")
    .update({ arquivo_status: "arquivando", arquivo_tentativa_em: new Date().toISOString() })
    .eq("id", id)
    .eq("deleted", false)
    .or(
      `arquivo_status.is.null,arquivo_status.neq.arquivando,arquivo_tentativa_em.is.null,arquivo_tentativa_em.lt.${obsoleta}`,
    )
    .select("id");
  if (erroTrava) return NextResponse.json({ erro: "Erro ao consultar o banco." }, { status: 500 });
  if (!tomado || tomado.length === 0) {
    return NextResponse.json({ erro: "Esta página já está sendo arquivada." }, { status: 409 });
  }

  const temCopia = !!link.arquivo_path;
  const tmp = path.join(os.tmpdir(), `arquivar-${id}.html`);
  const tmpPng = path.join(os.tmpdir(), `arquivar-${id}.png`);
  try {
    // A página precisa responder 2xx; um 404 ou 503 não vira "cópia".
    const status = await statusDaPagina(link.url);
    if (status < 200 || status > 299) {
      throw new FalhaDeArquivamento(`A página respondeu com erro HTTP ${status}.`);
    }

    const navegador = await localizarNavegador();
    await capturar(link.url, tmp, navegador);
    const html = await fs.readFile(tmp);
    validarCaptura(html, { temCopia, tamanhoAtual: link.arquivo_tam ?? null });

    const caminho = `${id}.html`;
    const up = await sb.storage.from(BUCKET).upload(caminho, html, { upsert: true, contentType: "text/html" });
    if (up.error) throw new Error("storage: " + up.error.message);

    const { error: erroGravar } = await sb
      .from("central_links")
      .update({
        arquivo_path: caminho,
        arquivo_tam: html.length,
        arquivado_em: new Date().toISOString(),
        arquivo_status: "ok",
        arquivo_erro: null,
      })
      .eq("id", id);
    if (erroGravar) throw new Error("banco: " + erroGravar.message);

    // A miniatura é um extra: se falhar (ou se a migration 077 não foi aplicada), o arquivamento segue valendo.
    await guardarMiniatura(sb, id, tmp, tmpPng, navegador);

    return NextResponse.json({ ok: true, tamanho: html.length });
  } catch (e) {
    const falhaConhecida = e instanceof FalhaDeArquivamento;
    const msg = limitarMensagem(falhaConhecida ? e.message : "Erro inesperado ao arquivar.");
    // Havendo cópia anterior, ela segue valendo; o aviso fica em arquivo_erro.
    try {
      await sb
        .from("central_links")
        .update({ arquivo_status: statusAposFalha(temCopia), arquivo_erro: msg })
        .eq("id", id);
    } catch {
      /* o erro original é o que importa */
    }
    return NextResponse.json({ erro: msg }, { status: falhaConhecida ? 422 : 500 });
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => {});
    await fs.rm(tmpPng, { force: true }).catch(() => {});
  }
}

/** Tira a miniatura da cópia salva, guarda no bucket e grava o caminho. Nunca lança. */
async function guardarMiniatura(
  sb: ReturnType<typeof createSupabaseServiceClient>,
  id: string,
  arquivoHtml: string,
  arquivoPng: string,
  navegador: Awaited<ReturnType<typeof localizarNavegador>>,
): Promise<void> {
  try {
    await capturarMiniatura(arquivoHtml, arquivoPng, navegador);
    const caminho = `miniaturas/${id}.png`;
    const up = await sb.storage.from(BUCKET).upload(caminho, await fs.readFile(arquivoPng), {
      upsert: true,
      contentType: "image/png",
    });
    if (up.error) return;
    await sb.from("central_links").update({ miniatura_path: caminho }).eq("id", id);
  } catch {
    /* sem miniatura o cartão mostra o espaço ilustrado */
  }
}
