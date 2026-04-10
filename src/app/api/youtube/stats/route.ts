// src/app/api/youtube/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/youtube/auth";
import { fetchChannelInfo } from "@/lib/youtube/data-api";
import type { Account, YouTubeCredentials } from "@/types/accounts";

// Cache em processo: evita chamar a Data API a cada carregamento de página
const cache = new Map<
  string,
  { data: { subscriber_count: number; video_count: number }; expiresAt: number }
>();

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

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
    let auth: { bearer: string } | { key: string };

    try {
      const accessToken = await getValidAccessToken(account as Account);
      auth = { bearer: accessToken };
    } catch {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "OAuth indisponível e YOUTUBE_API_KEY não configurada" }, { status: 500 });
      }
      auth = { key: apiKey };
    }

    const info = await fetchChannelInfo(creds.channel_id, auth);

    const result = {
      subscriber_count: info.subscriberCount,
      video_count: info.videoCount,
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
