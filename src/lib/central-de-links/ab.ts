// Helpers do Teste A/B (porte de api/_ab.js da Central de Links): funções puras.

/** host + path em minúsculas, sem query, hash, barra final, porta padrão e "www." */
export function normalizarUrl(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  let s = texto.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s.replace(/^\/\//, "");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  let host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!host) return null;
  const padrao = u.protocol === "https:" ? "443" : "80";
  if (u.port && u.port !== padrao) host += ":" + u.port;
  const path = u.pathname.toLowerCase().replace(/\/+$/, "");
  return host + path;
}

const ROBOS =
  /bot\b|bot[/ ;)_-]|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|preview|embedly|quora link|pinterest|monitor|uptime|pingdom|headless|phantomjs|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|curl\/|wget\/|python-requests|python-urllib|aiohttp|go-http-client|java\/|okhttp|libwww|httpclient|node-fetch|axios|scrapy|vercel-|ahrefs|semrush|mj12|dotbot|yandex|baidu|bingpreview|google-read-aloud|adsbot|mediapartners|apis-google|chrome-lighthouse|statuscake|datadog|newrelic/i;

/** User-agent vazio ou não textual conta como robô. */
export function ehRobo(userAgent: unknown): boolean {
  if (typeof userAgent !== "string" || !userAgent.trim()) return true;
  return ROBOS.test(userAgent);
}

export type Dispositivo = "tablet" | "celular" | "desktop";

export function classificarDispositivo(userAgent: unknown): Dispositivo {
  const ua = typeof userAgent === "string" ? userAgent : "";
  if (/ipad|tablet|playbook|silk|kindle/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i.test(ua)) return "celular";
  return "desktop";
}

export function navegador(userAgent: unknown): string {
  const ua = typeof userAgent === "string" ? userAgent : "";
  if (/edg(e|a|ios)?\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Outro";
}
