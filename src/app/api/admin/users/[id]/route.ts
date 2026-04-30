import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, userId } = await requireRole(["gestor"]);
  if (error) return error;

  const targetUserId = params.id;

  if (userId === targetUserId) {
    return NextResponse.json(
      { error: "Não é possível alterar sua própria função" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { role } = body;

  if (!role) {
    return NextResponse.json({ error: "role é obrigatório" }, { status: 400 });
  }

  const validRoles: UserRole[] = ["gestor", "analista", "comum"];
  if (!validRoles.includes(role)) {
    return NextResponse.json(
      { error: `role deve ser um de: ${validRoles.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: adminError } = await supabase.auth.admin.updateUserById(
    targetUserId,
    { app_metadata: { role } }
  );

  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data.user.id,
    email: data.user.email,
    role: (data.user.app_metadata?.role as UserRole) ?? "gestor",
  });
}
