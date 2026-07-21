/**
 * Backfill de `app_metadata.role` em contas legadas.
 *
 * PRÉ-REQUISITO DE DEPLOY do auto-cadastro (PRD #127). O fallback de role
 * passou de `?? "gestor"` para `?? "pendente"`; contas criadas antes das roles
 * existirem não têm `app_metadata.role` e dependiam do fallback antigo. Sem
 * este backfill elas caem todas em `/aguardando-aprovacao` no primeiro login —
 * inclusive os gestores, o que trava a aprovação para todo mundo.
 *
 * Roda fora do app, com service role, justamente para funcionar mesmo com o
 * acesso web bloqueado.
 *
 * Uma conta sem `app_metadata.role` é inequivocamente legada: todo cadastro
 * novo grava `role: "pendente"` explicitamente (src/app/api/auth/signup).
 * Por isso o default de backfill é `gestor` — é a role que essas contas já
 * tinham na prática, via fallback. Não é promoção, é preservação.
 *
 * Uso:
 *   node scripts/backfill-user-roles.mjs                    # dry-run (lista, não grava)
 *   node scripts/backfill-user-roles.mjs --apply            # grava `gestor` nas contas sem role
 *   node scripts/backfill-user-roles.mjs --apply --role=analista
 *   node scripts/backfill-user-roles.mjs --apply --only=alguem@dominio.com,outro@dominio.com
 *   node scripts/backfill-user-roles.mjs --apply --only-index=1,3   # posicoes do dry-run
 *
 * Idempotente: só toca em contas sem role. Rodar duas vezes não muda nada.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const VALID_ROLES = ["gestor", "analista", "comum"];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const roleArg = args.find((a) => a.startsWith("--role="))?.split("=")[1] ?? "gestor";
const onlyArg = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const only = onlyArg
  ? new Set(onlyArg.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))
  : null;

/**
 * Selecao por posicao na lista do dry-run (1-based). Existe porque a saida
 * mascara os e-mails: sem isso, so da para filtrar digitando o endereco
 * completo de memoria. Rode o dry-run imediatamente antes — a numeracao vale
 * para aquela listagem.
 */
const onlyIndexArg = args.find((a) => a.startsWith("--only-index="))?.split("=")[1];
const onlyIndex = onlyIndexArg
  ? new Set(
      onlyIndexArg
        .split(",")
        .map((n) => Number.parseInt(n.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  : null;

if (!VALID_ROLES.includes(roleArg)) {
  console.error(`--role invalida: "${roleArg}". Use uma de: ${VALID_ROLES.join(", ")}`);
  process.exit(1);
}

if (onlyIndexArg && (!onlyIndex || onlyIndex.size === 0)) {
  console.error(`--only-index invalido: "${onlyIndexArg}". Use posicoes inteiras, ex: --only-index=1,3`);
  process.exit(1);
}

if (only && onlyIndex) {
  console.error("Use --only OU --only-index, nao os dois.");
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

/** Pagina o listUsers ate o fim — o default do Supabase e 50 por pagina. */
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

/**
 * Termina sinalizando via `process.exitCode` e deixando o processo encerrar
 * sozinho. `process.exit()` derruba o runtime com os sockets keep-alive do
 * supabase-js ainda abertos, e no Windows isso dispara um assert do libuv
 * ("!(handle->flags & UV_HANDLE_CLOSING)") — que, no meio do loop de gravacao,
 * mataria o backfill pela metade.
 */
async function main() {
  const users = await listAllUsers();
  const roleless = users.filter((u) => !u.app_metadata?.role);

  let targets = roleless;
  let filterLabel = "";
  if (only) {
    targets = roleless.filter((u) => only.has((u.email ?? "").toLowerCase()));
    filterLabel = " (filtrado por --only)";
  } else if (onlyIndex) {
    targets = roleless.filter((_, i) => onlyIndex.has(i + 1));
    filterLabel = " (filtrado por --only-index)";
  }

  console.log(`contas totais:        ${users.length}`);
  console.log(`contas sem role:      ${roleless.length}`);
  console.log(`alvos deste backfill: ${targets.length}${filterLabel}\n`);

  if (roleless.length === 0) {
    console.log("Nada a fazer — nenhuma conta legada sem role.");
    return;
  }

  // Um filtro que nao casa com nada e quase sempre erro de digitacao. Tratar
  // como sucesso ("nada a fazer") faria o operador concluir que o backfill
  // estava feito e seguir para o deploy — direto no lockout.
  if (targets.length === 0) {
    console.error(
      `Nenhuma das ${roleless.length} contas sem role casa com ` +
        (only ? `--only=${onlyArg}` : `--only-index=${onlyIndexArg}`) +
        `.\nO filtro por e-mail exige o endereco exato. Rode sem filtro para ver` +
        ` a lista numerada e use --only-index=N.`
    );
    process.exitCode = 1;
    return;
  }

  // Numeracao sobre `roleless` (nao sobre `targets`) para que os indices
  // exibidos no dry-run sejam os mesmos aceitos por --only-index.
  for (const u of targets) {
    const position = roleless.indexOf(u) + 1;
    console.log(
      `  [${position}] ${mask(u.email).padEnd(28)} criada=${u.created_at?.slice(0, 10)}` +
        `  ultimo_login=${u.last_sign_in_at?.slice(0, 10) ?? "nunca"}  ->  ${roleArg}`
    );
  }

  if (!apply) {
    console.log(`\nDRY-RUN — nada foi gravado. Repita com --apply para aplicar.`);
    return;
  }

  console.log(`\nAplicando role "${roleArg}"...\n`);

  let ok = 0;
  const failures = [];

  for (const u of targets) {
    const { error } = await supabase.auth.admin.updateUserById(u.id, {
      app_metadata: { ...u.app_metadata, role: roleArg },
    });
    if (error) {
      failures.push({ email: mask(u.email), message: error.message });
      console.error(`  FALHOU  ${mask(u.email)}: ${error.message}`);
    } else {
      ok++;
      console.log(`  ok      ${mask(u.email)}`);
    }
  }

  console.log(`\natualizadas: ${ok}/${targets.length}`);

  if (failures.length > 0) {
    console.error(`falhas: ${failures.length} — role NAO gravada nessas contas.`);
    process.exitCode = 1;
    return;
  }

  console.log("Backfill concluido. As contas legadas voltam a logar normalmente.");
}

try {
  await main();
} catch (err) {
  console.error(`\nERRO: ${err.message}`);
  process.exitCode = 1;
}
