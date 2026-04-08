// src/app/api/auth/youtube/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, detectChannelId } from "@/lib/youtube/auth";
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

  // Recover account_id from short-lived cookie set during /connect
  const accountId = request.cookies.get("yt_oauth_account_id")?.value;
  if (!accountId) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=oauth_session_expired`, request.url)
    );
  }

  // Validate HMAC state to prevent CSRF
  const expectedState = createHmac("sha256", process.env.CRON_SECRET!)
    .update(accountId)
    .digest("hex");

  if (state !== expectedState) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=oauth_invalid_state`, request.url)
    );
  }

  const supabase = createSupabaseServiceClient();

  // Load existing credentials — client_id, client_secret, history_start_date
  // were saved by the settings form before redirecting to /connect
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
    // Exchange authorisation code for tokens
    const tokens = await exchangeCodeForTokens(
      code,
      existingCreds.client_id!,
      existingCreds.client_secret!
    );

    // Auto-detect channel_id using the fresh access_token
    const channelId = await detectChannelId(tokens.access_token);

    const newExpiry = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    // Persist all credentials
    await supabase
      .from("dash_gestao_accounts")
      .update({
        credentials: {
          ...existingCreds,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          access_token_expiry: newExpiry,
          channel_id: channelId,
        } as YouTubeCredentials,
      })
      .eq("id", accountId);

    const response = NextResponse.redirect(
      new URL(`${SETTINGS_URL}?connected=${encodeURIComponent(channelId)}`, request.url)
    );
    response.cookies.delete("yt_oauth_account_id");
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
