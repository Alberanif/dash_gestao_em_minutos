import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { listAllUsers } from "@/lib/supabase/list-all-users";

/** Teto duro de solicitações aguardando decisão do gestor. */
const MAX_PENDING = 20;

/** Rate limit por IP: melhor esforço, em memória (ver PRD #127 §8). */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const attemptsByIp = new Map<string, number[]>();

const MIN_PASSWORD_LENGTH = 8;

/** Mensagem única para e-mail já usado — não distingue conta ativa de pendente. */
const DUPLICATE_MESSAGE = "Este e-mail já possui conta ou solicitação em andamento";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconhecido";
}

/**
 * Descarta IPs cuja janela já expirou. Sem isso o mapa só cresce: um IP que
 * tentou uma vez e nunca voltou fica registrado para sempre, e a rota é
 * pública — o conjunto de IPs que a alcançam não é limitado.
 */
function evictExpired(now: number): void {
  for (const [ip, attempts] of attemptsByIp) {
    if (attempts.every((at) => now - at >= RATE_LIMIT_WINDOW_MS)) {
      attemptsByIp.delete(ip);
    }
  }
}

/** Registra a tentativa e diz se o IP estourou a janela. */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  evictExpired(now);

  const recent = (attemptsByIp.get(ip) ?? []).filter(
    (at) => now - at < RATE_LIMIT_WINDOW_MS
  );

  if (recent.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    attemptsByIp.set(ip, recent);
    return true;
  }

  recent.push(now);
  attemptsByIp.set(ip, recent);
  return false;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Erro de validação legível, ou null se o corpo estiver íntegro. */
function validationError(body: {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  passwordConfirm?: unknown;
}): string | null {
  const { name, email, password, passwordConfirm } = body;

  if (typeof name !== "string" || name.trim() === "") {
    return "Informe seu nome completo";
  }
  if (typeof email !== "string" || !isValidEmail(email)) {
    return "Informe um e-mail válido";
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  if (password !== passwordConfirm) {
    return "As senhas não coincidem";
  }
  return null;
}

/** O Supabase sinaliza e-mail duplicado de formas diferentes conforme o caso. */
function isDuplicateEmail(message: string): boolean {
  return /already been registered|already exists|duplicate/i.test(message);
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const invalid = validationError(body);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  if (isRateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      { status: 429 }
    );
  }

  const supabase = createSupabaseServiceClient();

  // O teto só protege se contar a fila inteira: contando uma página só, o
  // limite deixaria de valer assim que a base passasse do tamanho da página.
  const { users: allUsers, error: listError } = await listAllUsers(supabase);
  if (listError) {
    return NextResponse.json({ error: listError }, { status: 500 });
  }

  const pendingCount = allUsers.filter(
    (u) => u.app_metadata?.role === "pendente"
  ).length;

  if (pendingCount >= MAX_PENDING) {
    return NextResponse.json(
      { error: "Limite de solicitações atingido, tente mais tarde" },
      { status: 429 }
    );
  }

  const { name, email, password } = body;
  const { data, error } = await supabase.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    app_metadata: { role: "pendente" },
    user_metadata: { name: name.trim() },
  });

  if (error) {
    if (isDuplicateEmail(error.message)) {
      return NextResponse.json({ error: DUPLICATE_MESSAGE }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { id: data.user.id, email: data.user.email },
    { status: 201 }
  );
}
