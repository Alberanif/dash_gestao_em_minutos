import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountRole, UserRole } from "@/types/auth";

export async function validateApiAuth(): Promise<{
  error: NextResponse | null;
  userId: string | null;
  role: AccountRole;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      role: "pendente",
    };
  }

  // Fallback seguro: role ausente ou desconhecida vale como `pendente` (bloqueio),
  // nunca como `gestor`.
  const role = (user.app_metadata?.role as AccountRole) ?? "pendente";

  // Conta aguardando aprovação: autentica, mas nenhuma API de negócio é liberada.
  if (role === "pendente") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: user.id,
      role,
    };
  }

  return { error: null, userId: user.id, role };
}

export async function validateCronApiKey(request: NextRequest): Promise<{
  error: NextResponse | null;
}> {
  const authHeader = request.headers.get("authorization");
  const expectedKey = process.env.CRON_SECRET;

  if (!authHeader || !expectedKey) {
    return {
      error: NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 }
      ),
    };
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || token !== expectedKey) {
    return {
      error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
    };
  }

  return { error: null };
}

/**
 * Sem `error`, a role devolvida está garantidamente em `allowedRoles` — ou seja,
 * é sempre uma `UserRole` de acesso, nunca `pendente`.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<{
  error: NextResponse | null;
  userId: string | null;
  role: AccountRole;
}> {
  const result = await validateApiAuth();
  if (result.error) return result;

  if (!allowedRoles.includes(result.role as UserRole)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: result.role,
    };
  }

  return result;
}
