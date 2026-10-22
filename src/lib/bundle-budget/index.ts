// Orçamento de JS inicial das rotas /v2/* (PRD #250, seção 4).
// Lógica pura: lê os manifests do build do Next e decide se a rota estourou.
// A leitura de disco e o gzip ficam em scripts/check-v2-bundle.ts.

export const V2_BUDGET_BYTES = 180 * 1024;

export interface BuildManifest {
  rootMainFiles?: string[];
}

export interface ClientReferenceManifest {
  entryJSFiles?: Record<string, string[]>;
  clientModules?: Record<string, { chunks?: string[] }>;
}

export type LoadableManifest = Record<string, { files?: string[] }>;

export interface RouteManifests {
  route: string;
  buildManifest: BuildManifest;
  clientManifest: ClientReferenceManifest;
  loadableManifest: LoadableManifest;
}

export interface RouteReport {
  route: string;
  files: { file: string; gzipBytes: number }[];
  bytes: number;
  over: boolean;
}

const normalize = (file: string) => file.replace(/^\/?(_next\/)?/, "");
const isJs = (file: string) => file.endsWith(".js");

export function parseClientReferenceManifest(source: string): ClientReferenceManifest {
  const match = source.match(/__RSC_MANIFEST\[[^\]]+\]\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if (!match) throw new Error("client-reference-manifest em formato inesperado");
  return JSON.parse(match[1]) as ClientReferenceManifest;
}

// JS inicial = runtime + chunks dos layouts e dos componentes client da rota, menos
// o que só carrega sob demanda (next/dynamic, ex.: o chunk do WebGL). Os polyfills
// ficam de fora: o Next os emite com `noModule` e navegador moderno nem baixa.
export function collectInitialFiles(m: RouteManifests): string[] {
  const eager = new Set<string>();
  for (const f of m.buildManifest.rootMainFiles ?? []) eager.add(normalize(f));
  for (const files of Object.values(m.clientManifest.entryJSFiles ?? {})) {
    for (const f of files) eager.add(normalize(f));
  }
  for (const mod of Object.values(m.clientManifest.clientModules ?? {})) {
    for (const f of mod.chunks ?? []) eager.add(normalize(f));
  }
  const lazy = new Set<string>();
  for (const entry of Object.values(m.loadableManifest)) {
    for (const f of entry.files ?? []) lazy.add(normalize(f));
  }
  // Um chunk que é lazy e também entrada de layout continua contando: só sai o que é exclusivamente sob demanda.
  const guaranteed = new Set<string>();
  for (const files of Object.values(m.clientManifest.entryJSFiles ?? {})) {
    for (const f of files) guaranteed.add(normalize(f));
  }
  return [...eager].filter((f) => isJs(f) && (!lazy.has(f) || guaranteed.has(f))).sort();
}

export function evaluateRoute(
  route: string,
  files: { file: string; gzipBytes: number }[],
  budget: number = V2_BUDGET_BYTES,
): RouteReport {
  const bytes = files.reduce((sum, f) => sum + f.gzipBytes, 0);
  return { route, files, bytes, over: bytes > budget };
}

export function formatReport(reports: RouteReport[], budget: number = V2_BUDGET_BYTES): string {
  const kb = (n: number) => (n / 1024).toFixed(1);
  const lines = [`| Rota | JS inicial (gzip) | Limite | Status |`, `|---|---|---|---|`];
  for (const r of reports) {
    lines.push(`| ${r.route} | ${kb(r.bytes)} KB | ${kb(budget)} KB | ${r.over ? "ESTOUROU" : "ok"} |`);
  }
  return lines.join("\n");
}
