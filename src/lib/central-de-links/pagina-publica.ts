/** Transformação pura do HTML arquivado servido em /p/<slug ou id> (porte de api/pagina.js). */

export function idPublicoValido(id: string): boolean {
  return /^[a-zA-Z0-9-]{1,120}$/.test(id);
}

export function ehUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escaparHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Troca o <title> pelo rótulo (escapado); sem <title>, entra após <head>; sem <head>, no começo. */
export function injetarTitulo(html: string, label: string): string {
  const titulo = `<title>${escaparHtml(label)}</title>`;
  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, () => titulo);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => m + titulo);
  }
  return titulo + html;
}

export function montarSelo(arquivadoEm: string | null): string {
  const data = arquivadoEm
    ? " em " + new Date(arquivadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "";
  return (
    '<div style="position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:6px 10px;' +
    "background:rgba(6,11,31,.88);color:#e8c97a;border:1px solid rgba(205,160,76,.5);border-radius:999px;" +
    "font:500 11px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;" +
    'pointer-events:none">Página arquivada' +
    escaparHtml(data) +
    "</div>"
  );
}

export function injetarSelo(html: string, selo: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, () => selo + "</body>");
  }
  return html + selo;
}

export function transformarPagina(
  html: string,
  link: { label: string; arquivado_em: string | null },
): string {
  return injetarSelo(injetarTitulo(html, link.label), montarSelo(link.arquivado_em));
}

export const PAGINA_NAO_ENCONTRADA_HTML =
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  "<title>Página não encontrada</title>" +
  '<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#060B1F;color:#8b93b8;font-family:system-ui,sans-serif">' +
  "<p>Página não encontrada.</p></body>";
