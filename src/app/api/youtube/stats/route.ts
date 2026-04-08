// src/app/api/youtube/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/youtube/auth";
import type { Account, YouTubeCredentials } from "@/types/accounts";

// Simple in-process cache: avoids hammering Data API on every page load
const cache = new Map<string, { data: { subscriber_count: number; video_count: number }; expiresAt: number }>();

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  // Return cached result if still fresh (1 hour)
  const cached = cache.get(accountId);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const supabase = createSupabaseServiceClient();
  const { data: account } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  const creds = account.credentials as YouTubeCredentials;

  try {
    const accessToken = await getValidAccessToken(account as Account);

    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "statistics");
    url.searchParams.set("id", creds.channel_id);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Data API (${res.status}): ${await res.text()}`);
    }

    const json = await res.json();
    const stats = json.items?.[0]?.statistics ?? {};

    const result = {
      subscriber_count: parseInt(stats.subscriberCount ?? "0"),
      video_count: parseInt(stats.videoCount ?? "0"),
    };

    cache.set(accountId, { data: result, expiresAt: Date.now() + 3_600_000 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
