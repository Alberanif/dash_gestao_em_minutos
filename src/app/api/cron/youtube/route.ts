import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/utils/cron-auth";
import { collectYouTubeChannel } from "@/lib/services/youtube";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createSupabaseServiceClient();
  const startedAt = new Date().toISOString();

  try {
    const result = await collectYouTubeChannel();

    await supabase.from("dash_gestao_cron_logs").insert({
      job_name: "youtube",
      status: "success",
      records_collected: result.channelRecords + result.videoRecords,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await supabase.from("dash_gestao_cron_logs").insert({
      job_name: "youtube",
      status: "error",
      error_message: message,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
