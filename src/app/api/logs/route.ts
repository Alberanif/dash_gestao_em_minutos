import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");

  if (!platform || !["youtube", "instagram", "hotmart", "meta-ads"].includes(platform)) {
    return NextResponse.json(
      { error: "platform must be youtube, instagram, hotmart or meta-ads" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data, error: dbError } = await supabase
    .from("dash_gestao_cron_logs")
    .select("id, job_name, status, records_collected, error_message, started_at, finished_at, account_id, dash_gestao_accounts(name)")
    .eq("job_name", platform)
    .order("started_at", { ascending: false })
    .limit(100);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const logs = (data ?? []).map((row) => {
    const accountName =
      row.dash_gestao_accounts && typeof row.dash_gestao_accounts === "object" && "name" in row.dash_gestao_accounts
        ? (row.dash_gestao_accounts as { name: string }).name
        : null;

    const durationS =
      row.started_at && row.finished_at
        ? Math.round(
            (new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()) / 1000
          )
        : null;

    return {
      id: row.id,
      status: row.status,
      account_name: accountName,
      started_at: row.started_at,
      finished_at: row.finished_at,
      duration_s: durationS,
      records_collected: row.records_collected,
      error_message: row.error_message,
    };
  });

  return NextResponse.json({ logs });
}
