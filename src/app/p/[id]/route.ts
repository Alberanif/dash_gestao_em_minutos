import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  PAGINA_NAO_ENCONTRADA_HTML,
  ehUuid,
  idPublicoValido,
  transformarPagina,
} from "@/lib/central-de-links/pagina-publica";

// Endereço público (sem login) das páginas arquivadas: /p/<slug ou id do link>.
// O Storage entrega HTML de usuário como text/plain; aqui o arquivo é lido com a
// service key e devolvido como text/html.

function naoEncontrada(status = 404) {
  return new NextResponse(PAGINA_NAO_ENCONTRADA_HTML, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return naoEncontrada(500);
    }
    const { id } = await ctx.params;
    if (!idPublicoValido(id)) return naoEncontrada();

    const sb = createSupabaseServiceClient();
    const { data: link, error } = await sb
      .from("central_links")
      .select("label, arquivo_path, arquivado_em")
      .eq(ehUuid(id) ? "id" : "slug", id)
      .eq("deleted", false)
      .eq("pagina_ativa", true)
      .not("arquivo_path", "is", null)
      .limit(1)
      .maybeSingle();
    if (error || !link || !link.arquivo_path) return naoEncontrada();

    const { data: arquivo, error: erroArquivo } = await sb.storage.from("paginas").download(link.arquivo_path);
    if (erroArquivo || !arquivo) return naoEncontrada();

    const html = transformarPagina(await arquivo.text(), link);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return naoEncontrada(500);
  }
}
