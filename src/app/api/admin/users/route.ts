import { NextRequest, NextResponse } from "next/server";
import { requireRole, validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/auth";

export async function GET() {
  const { error, userId } = await requireRole(["gestor"]);
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: adminError } = await supabase.auth.admin.listUsers();

  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 500 });
  }

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    role: (u.app_metadata?.role as UserRole) ?? "gestor",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const body = await request.json();
  const { email, password, role = "comum" } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "email e password são obrigatórios" },
      { status: 400 }
    );
  }

  const validRoles: UserRole[] = ["gestor", "analista", "comum"];
  if (!validRoles.includes(role)) {
    return NextResponse.json(
      { error: `role deve ser um de: ${validRoles.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: adminError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });

  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: data.user.id,
      email: data.user.email,
      role: (data.user.app_metadata?.role as UserRole) ?? "comum",
    },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const userId = request.nextUrl.searchParams.get("id");
  if (!userId) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { error: adminError } = await supabase.auth.admin.deleteUser(userId);

  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
