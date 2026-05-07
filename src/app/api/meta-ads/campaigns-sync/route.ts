// src/app/api/meta-ads/campaigns-sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { collectMetaAdsCampaignsList } from "@/lib/services/meta-ads";
import type { Account } from "@/types/accounts";

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { account_id } = body;

  if (!account_id) {
    return NextResponse.json(
      { error: "account_id is required" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  // Fetch account by ID
  const { data: account, error: accountError } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .eq("id", account_id)
    .eq("platform", "meta-ads")
    .single();

  if (accountError || !account) {
    return NextResponse.json(
      { error: "Account not found" },
      { status: 404 }
    );
  }

  try {
    const result = await collectMetaAdsCampaignsList(account as Account);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
