// Verificação do recorte por data do Dash Ultimates (spec 2026-08-02).
//
// PROPRIEDADE VERIFICADA, independente do volume de dados:
//   para qualquer dia D, toda linha devolvida com intervalo [D, D] tem
//   approved_date dentro de [D 03:00Z, D+1 03:00Z) — ou seja, dentro do dia D
//   em horário de Brasília.
//
// Por que um script e não um teste: o fuso vive em SQL, e este repo não tem
// harness para RPC. Nenhum teste unitário pegaria esta classe de bug — foi
// exatamente assim que a correção do hourly (migration 054) deixou de se
// propagar para daily e roster por três migrations.
//
// Uso:
//   node scripts/verify-ultimates-timezone.mjs <cycle-id> <YYYY-MM-DD>
//
// Antes da migration 064 este script FALHA para o ciclo Pitch PC Ao Vivo -
// 2026 no dia 2026-08-01: a compra HP0389248222 (31/07 22:57 BRT) aparece
// dentro da janela porque o filtro roda em UTC.
//
// Códigos de saída: 0 = propriedade vale; 1 = há linha fora do dia em BRT;
// 2 = não deu para perguntar (argumento, .env, ciclo ou RPC inacessível).
//
// ── Notas de execução (para quem rodar isto no futuro) ──────────────────────
//
// IMPORT DE @supabase/supabase-js: o import bare abaixo funciona sem nenhum
// workaround, e foi verificado executando este arquivo. O pacote (2.101.1) não
// tem `dist/module/`, mas tem um campo `exports` no package.json que mapeia a
// condição `import` para `./dist/index.mjs` — o Node resolve por aí, não pelo
// layout de diretórios. Como este arquivo é `.mjs`, ele é ESM mesmo o
// package.json do projeto não declarando `"type": "module"`. Resolução de
// especificador bare parte do diretório DO ARQUIVO e sobe: `scripts/` →
// `node_modules/` da raiz. Mesmo caminho de `scripts/backfill-user-roles.mjs`.
// Se um dia isto quebrar, o suspeito é `node_modules` ausente/parcial (rode
// `npm install`), não o caminho do import.
//
// .env: resolvido a partir da localização DESTE arquivo (`../.env`), não de
// `process.cwd()`. Assim o script roda de qualquer diretório — de dentro de
// `scripts/`, de um worktree, de um atalho — em vez de só da raiz do repo.
//
// SÓ LÊ. Nenhuma escrita no banco.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const [cycleId, dia] = process.argv.slice(2);

if (!cycleId || !/^\d{4}-\d{2}-\d{2}$/.test(dia ?? "")) {
  console.error("uso: node scripts/verify-ultimates-timezone.mjs <cycle-id> <YYYY-MM-DD>");
  process.exit(2);
}

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(raizRepo, ".env");

if (!fs.existsSync(envPath)) {
  console.error(`.env não encontrado em ${envPath}`);
  process.exit(2);
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    `.env sem NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY (${envPath})`
  );
  process.exit(2);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// BRT é UTC-3 e o Brasil não tem horário de verão desde 2019, então o dia BRT D
// corresponde a [D 03:00Z, D+1 03:00Z). Fronteira calculada uma vez, aqui, em
// vez de espalhada pelas asserções.
const inicioUtc = new Date(`${dia}T03:00:00.000Z`).getTime();
const fimUtc = inicioUtc + 24 * 60 * 60 * 1000;

const { data: ciclo, error: erroCiclo } = await sb
  .from("dash_gestao_ultimates_cycles")
  .select("id, name, purchases_only")
  .eq("id", cycleId)
  .single();

if (erroCiclo || !ciclo) {
  console.error(`ciclo não encontrado: ${erroCiclo?.message ?? cycleId}`);
  process.exit(2);
}

const rpcPreferida = ciclo.purchases_only
  ? "dash_gestao_ultimates_purchases"
  : "dash_gestao_ultimates_roster";

const janela = { p_cycle_id: cycleId, p_start: dia, p_end: dia };

let rpc = rpcPreferida;
let { data: linhas, error } = await sb.rpc(rpc, janela);

// FALLBACK DELIBERADO. Antes da migration 064, dash_gestao_ultimates_purchases
// não existe e o PostgREST devolve PGRST202. Sem este fallback o script sairia
// 2 ("não consegui perguntar") justamente no ambiente em que precisa sair 1
// ("a resposta está errada") — e um verificador que só sabe dizer "não sei" no
// estado com bug não verifica nada.
//
// A propriedade é a MESMA nas duas RPCs: a janela [D, D] é aplicada sobre
// approved_date, e é esse filtro que a 064 move para cycle_sales em BRT. A
// roster existe desde a 061 (janela desde a 058), então ela responde hoje e
// mostra o mesmo recorte errado. Depois da 064 este ramo nunca mais roda.
if (error?.code === "PGRST202" && rpc === "dash_gestao_ultimates_purchases") {
  console.warn(
    `aviso: ${rpc} não existe (migration 064 pendente) — verificando a mesma ` +
      `propriedade em dash_gestao_ultimates_roster, que aplica a janela igual.`
  );
  rpc = "dash_gestao_ultimates_roster";
  ({ data: linhas, error } = await sb.rpc(rpc, janela));
}

if (error) {
  console.error(`falha ao chamar ${rpc}: ${error.message}`);
  process.exit(2);
}

// Linhas sem venda no período (categoria nao_renovado do ciclo de renovação)
// não têm data e não participam da propriedade — a janela não as filtra.
const comData = linhas.filter((l) => l.renewed_at !== null);
const foraDaJanela = comData.filter((l) => {
  const t = new Date(l.renewed_at).getTime();
  return t < inicioUtc || t >= fimUtc;
});

console.log(`ciclo .............. ${ciclo.name}`);
console.log(`rpc ................ ${rpc}`);
console.log(`dia (BRT) .......... ${dia}`);
console.log(`janela esperada .... ${new Date(inicioUtc).toISOString()} → ${new Date(fimUtc).toISOString()}`);
console.log(`linhas devolvidas .. ${linhas.length} (${comData.length} com data)`);

if (foraDaJanela.length > 0) {
  console.error(`\nFALHOU: ${foraDaJanela.length} linha(s) fora do dia ${dia} em BRT:`);
  for (const l of foraDaJanela) {
    const brt = new Date(new Date(l.renewed_at).getTime() - 3 * 3600 * 1000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);
    console.error(`  ${l.transaction_code ?? "(sem transação)"}  ${l.email}  ${l.renewed_at}  = ${brt} BRT`);
  }
  process.exit(1);
}

console.log(`\nOK: toda linha devolvida cai dentro do dia ${dia} em horário de Brasília.`);
