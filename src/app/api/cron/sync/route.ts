import { NextRequest, NextResponse } from "next/server";
import { validateCronApiKey } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { syncPlatform } from "@/lib/services/sync-platform";

export async function POST(request: NextRequest) {
  const authError = await validateCronApiKey(request);
  if (authError.error) return authError.error;

  const body = await request.json().catch(() => null);
  const platform = body?.platform;

  if (!platform || !["youtube", "instagram", "hotmart", "meta-ads"].includes(platform)) {
    return NextResponse.json(
      { error: "platform must be youtube, instagram, hotmart or meta-ads" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const results = await syncPlatform(platform, supabase);

  if (results.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma conta ativa encontrada para esta plataforma" },
      { status: 404 }
    );
  }

  return NextResponse.json({ results });
}
