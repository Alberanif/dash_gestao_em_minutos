// src/app/api/auth/youtube/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/youtube/auth";
import type { YouTubeCredentials } from "@/types/accounts";

const SETTINGS_URL = "/dashboard/settings";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=oauth_missing_params`, request.url)
    );
  }

  const accountId = request.cookies.get("yt_oauth_account_id")?.value;
  if (!accountId) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=oauth_session_expired`, request.url)
    );
  }

  const expectedState = createHmac("sha256", process.env.CRON_SECRET!)
    .update(accountId)
    .digest("hex");

  if (state !== expectedState) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=oauth_invalid_state`, request.url)
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data: account } = await supabase
    .from("dash_gestao_accounts")
    .select("credentials")
    .eq("id", accountId)
    .maybeSingle();

  if (!account) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=account_not_found`, request.url)
    );
  }

  const existingCreds = account.credentials as Partial<YouTubeCredentials>;

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      existingCreds.client_id!,
      existingCreds.client_secret!
    );

    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Preserve all existing credentials (channel_id, uploads_playlist_id, etc.)
    // and only update the OAuth tokens
    const newCredentials: YouTubeCredentials = {
      ...(existingCreds as YouTubeCredentials),
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expiry: newExpiry,
    };

    const { error: updateError } = await supabase
      .from("dash_gestao_accounts")
      .update({ credentials: newCredentials })
      .eq("id", accountId)
      .select();

    if (updateError) {
      throw new Error(`Falha ao salvar tokens: ${updateError.message}`);
    }

    const response = NextResponse.redirect(
      new URL(`${SETTINGS_URL}?connected=${encodeURIComponent(existingCreds.channel_id ?? "")}`, request.url)
    );
    response.cookies.delete("yt_oauth_account_id");
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    console.error("[youtube/callback] error:", msg);
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
