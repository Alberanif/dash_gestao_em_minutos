import { createSupabaseServiceClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createSupabaseServiceClient>;

export async function fetchDistinctLeadEvents(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("dash_gestao_distinct_lead_events");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row: { evento: string | null }) => String(row.evento ?? "").trim())
    .filter(Boolean);
}
