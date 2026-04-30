import { NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  let migrated = 0;

  for (const user of data.users) {
    if (!user.app_metadata?.role) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { app_metadata: { role: "gestor" } }
      );

      if (!updateError) {
        migrated++;
      }
    }
  }

  return NextResponse.json({
    message: "Migration complete",
    migrated,
    total: data.users.length,
  });
}
