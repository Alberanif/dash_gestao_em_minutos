/**
 * Migra contas com `app_metadata.role = "comum"` para `analista`.
 *
 * O papel `comum` está sendo extinto: só existem `gestor` e `analista`. Esta migração AUMENTA o acesso
 * das contas afetadas (o `comum` só via a Base de Dados; o `analista` vê tudo, menos Configurações).
 * Por isso o default é dry-run e a lista deve ser revisada antes do --apply. Contas que não devem ver os
 * dados de gestão: rode com --to=pendente para elas (ou exclua-as da seleção e trate à parte).
 *
 * Uso:
 *   node scripts/migrar-comum-para-analista.mjs                       # dry-run: lista as contas `comum`
 *   node scripts/migrar-comum-para-analista.mjs --apply               # grava `analista` em todas
 *   node scripts/migrar-comum-para-analista.mjs --apply --only-index=1,3   # só as posições do dry-run
 *   node scripts/migrar-comum-para-analista.mjs --apply --only-index=2 --to=pendente
 *
 * Idempotente: só toca em contas que ainda estão como `comum`. Rodar duas vezes não muda nada.
 * Roda fora do app, com service role (mesmo padrão de backfill-user-roles.mjs).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const DESTINOS = ["analista", "pendente"];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const to = args.find((a) => a.startsWith("--to="))?.split("=")[1] ?? "analista";
const onlyIndexArg = args.find((a) => a.startsWith("--only-index="))?.split("=")[1];
const onlyIndex = onlyIndexArg
  ? new Set(
      onlyIndexArg
        .split(",")
        .map((n) => Number.parseInt(n.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  : null;

if (!DESTINOS.includes(to)) {
  console.error(`--to invalido: "${to}". Use um de: ${DESTINOS.join(", ")}`);
  process.exit(1);
}
if (onlyIndexArg && (!onlyIndex || onlyIndex.size === 0)) {
  console.error(`--only-index invalido: "${onlyIndexArg}". Use posicoes inteiras, ex: --only-index=1,3`);
  process.exit(1);
}

function loadEnv(path = ".env") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

const env = { ...loadEnv(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers falhou: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

const mask = (email) => (email ?? "(sem email)").replace(/^(.{2}).*?@/, "$1***@");

// Sem process.exit(): no Windows ele derruba o runtime com sockets abertos no meio da gravação.
async function main() {
  const users = await listAllUsers();
  const comuns = users.filter((u) => u.app_metadata?.role === "comum");
  const targets = onlyIndex ? comuns.filter((_, i) => onlyIndex.has(i + 1)) : comuns;

  console.log(`contas totais:        ${users.length}`);
  console.log(`contas "comum":       ${comuns.length}`);
  console.log(`alvos desta execucao: ${targets.length}${onlyIndex ? " (filtrado por --only-index)" : ""}\n`);

  if (comuns.length === 0) {
    console.log('Nada a fazer — nenhuma conta "comum".');
    return;
  }
  if (targets.length === 0) {
    console.error(`Nenhuma conta casa com --only-index=${onlyIndexArg}. Rode sem filtro para ver a lista numerada.`);
    process.exitCode = 1;
    return;
  }

  for (const u of targets) {
    console.log(
      `  [${comuns.indexOf(u) + 1}] ${mask(u.email).padEnd(28)} criada=${u.created_at?.slice(0, 10)}` +
        `  ultimo_login=${u.last_sign_in_at?.slice(0, 10) ?? "nunca"}  ->  ${to}`
    );
  }

  if (!apply) {
    console.log("\nDRY-RUN — nada foi gravado. Revise a lista e repita com --apply.");
    return;
  }

  console.log(`\nAplicando "${to}"...\n`);
  let ok = 0;
  let falhas = 0;
  for (const u of targets) {
    const { error } = await supabase.auth.admin.updateUserById(u.id, {
      app_metadata: { ...u.app_metadata, role: to },
    });
    if (error) {
      falhas++;
      console.error(`  FALHOU  ${mask(u.email)}: ${error.message}`);
    } else {
      ok++;
      console.log(`  ok      ${mask(u.email)}`);
    }
  }
  console.log(`\natualizadas: ${ok}/${targets.length}`);
  if (falhas > 0) {
    console.error(`falhas: ${falhas} — role NAO gravada nessas contas.`);
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (err) {
  console.error(`\nERRO: ${err.message}`);
  process.exitCode = 1;
}
