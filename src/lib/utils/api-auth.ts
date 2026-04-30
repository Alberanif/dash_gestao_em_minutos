import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/auth";

export async function validateApiAuth(): Promise<{
  error: NextResponse | null;
  userId: string | null;
  role: UserRole;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      role: "gestor",
    };
  }

  const role = (user.app_metadata?.role as UserRole) ?? "gestor";

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

export async function requireRole(allowedRoles: UserRole[]): Promise<{
  error: NextResponse | null;
  userId: string | null;
  role: UserRole;
}> {
  const result = await validateApiAuth();
  if (result.error) return result;

  if (!allowedRoles.includes(result.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: result.role,
    };
  }

  return result;
}
