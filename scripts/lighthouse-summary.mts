// Resume um relatório JSON do Lighthouse (LCP, TBT, CLS) para o resumo do job.
// Uso: node scripts/lighthouse-summary.mts lighthouse/v2.report.json
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Informe o relatório JSON do Lighthouse.");
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(file, "utf8"));
const audit = (id: string) => report.audits?.[id]?.displayValue ?? "n/d";
const finalUrl: string = report.finalDisplayedUrl ?? report.finalUrl ?? "n/d";
const redirected = !new URL(finalUrl).pathname.startsWith("/v2");

const lines = [
  "## Lighthouse em /v2",
  "",
  `URL medida: ${finalUrl}`,
  redirected ? "\n> Atenção: foi redirecionado para fora de /v2 (sem sessão). Configure o secret LIGHTHOUSE_COOKIE para medir a página real.\n" : "",
  "| Métrica | Valor | Meta |",
  "|---|---|---|",
  `| LCP | ${audit("largest-contentful-paint")} | menos de 2 s no desktop |`,
  `| TBT (proxy de INP no laboratório) | ${audit("total-blocking-time")} | menos de 200 ms |`,
  `| CLS | ${audit("cumulative-layout-shift")} | menos de 0,1 |`,
  "",
  "O INP real só existe com interação de usuário; o Lighthouse em modo de navegação não o mede.",
];
const out = lines.join("\n");
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + "\n");
