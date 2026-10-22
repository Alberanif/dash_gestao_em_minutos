// Mede o JS inicial (gzip) de cada rota /v2/* a partir de um `next build` já feito
// e falha (exit 1) se alguma passar de 180 KB. Uso: node scripts/check-v2-bundle.mts [distDir]
// Roda direto no Node 24 (remoção nativa de tipos), sem dependência extra.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  V2_BUDGET_BYTES,
  collectInitialFiles,
  evaluateRoute,
  formatReport,
  parseClientReferenceManifest,
  type RouteReport,
} from "../src/lib/bundle-budget/index.ts";

const distDir = path.resolve(process.argv[2] ?? ".next");
const v2Dir = path.join(distDir, "server", "app", "v2");

function* findPageDirs(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === "page") yield full;
    else yield* findPageDirs(full);
  }
}

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));

if (!fs.existsSync(v2Dir)) {
  console.error(`Sem build das rotas /v2 em ${v2Dir}. Rode \`npm run build\` antes.`);
  process.exit(1);
}

const gzipCache = new Map<string, number>();
const gzipSize = (file: string) => {
  const hit = gzipCache.get(file);
  if (hit !== undefined) return hit;
  const size = zlib.gzipSync(fs.readFileSync(path.join(distDir, file))).length;
  gzipCache.set(file, size);
  return size;
};

const reports: RouteReport[] = [];
for (const pageDir of findPageDirs(v2Dir)) {
  const segments = path.relative(path.join(distDir, "server", "app"), path.dirname(pageDir)).split(path.sep);
  const route = "/" + segments.filter((s) => !/^\(.*\)$/.test(s)).join("/");
  const clientManifestFile = path.join(path.dirname(pageDir), "page_client-reference-manifest.js");
  const loadableFile = path.join(pageDir, "react-loadable-manifest.json");
  const files = collectInitialFiles({
    route,
    buildManifest: readJson(path.join(pageDir, "build-manifest.json")),
    clientManifest: fs.existsSync(clientManifestFile)
      ? parseClientReferenceManifest(fs.readFileSync(clientManifestFile, "utf8"))
      : {},
    loadableManifest: fs.existsSync(loadableFile) ? readJson(loadableFile) : {},
  }).map((file) => ({ file, gzipBytes: gzipSize(file) }));
  reports.push(evaluateRoute(route, files));
}

// Sem nenhuma rota medida o job passaria em silêncio: tratar como erro.
if (reports.length === 0) {
  console.error(`Nenhuma rota /v2 encontrada em ${v2Dir}.`);
  process.exit(1);
}

reports.sort((a, b) => a.route.localeCompare(b.route));
const table = formatReport(reports);
console.log(table);
fs.writeFileSync(path.join(distDir, "v2-bundle-report.json"), JSON.stringify({ budget: V2_BUDGET_BYTES, reports }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## JS inicial das rotas /v2\n\n${table}\n`);
}

const over = reports.filter((r) => r.over);
if (over.length > 0) {
  console.error(`\n${over.length} rota(s) acima de ${V2_BUDGET_BYTES / 1024} KB gzip: ${over.map((r) => r.route).join(", ")}`);
  console.error("Primeiro corte previsto: tirar o Supabase client do navegador (docs/V2_ORCAMENTO_DESEMPENHO.md).");
  process.exit(1);
}
