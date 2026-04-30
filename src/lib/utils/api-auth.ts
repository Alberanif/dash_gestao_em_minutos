import { NextResponse } from "next/server";
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
