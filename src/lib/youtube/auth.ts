// src/lib/youtube/auth.ts
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account, YouTubeCredentials } from "@/types/accounts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function buildOAuthUrl(accountId: string, state: string): string {
  const scopes = [
    "https://www.googleapis.com/auth/yt-analytics.readonly",
    "https://www.googleapis.com/auth/youtube.readonly",
  ].join(" ");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set(
    "redirect_uri",
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/youtube/callback`
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // forces refresh_token issuance
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/youtube/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function detectChannelId(accessToken: string): Promise<string> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "id");
  url.searchParams.set("mine", "true");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Channel detection failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const channelId = data.items?.[0]?.id;
  if (!channelId) throw new Error("No YouTube channel found for this Google account");
  return channelId;
}

export async function getValidAccessToken(account: Account): Promise<string> {
  const creds = account.credentials as YouTubeCredentials;

  // Return current token if valid for at least 5 more minutes
  if (creds.access_token && creds.access_token_expiry) {
    const expiresAt = new Date(creds.access_token_expiry).getTime();
    if (expiresAt - Date.now() > 5 * 60 * 1000) {
      return creds.access_token;
    }
  }

  // Refresh
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

  // Persist updated tokens
  const supabase = createSupabaseServiceClient();
  await supabase
    .from("dash_gestao_accounts")
    .update({
      credentials: {
        ...creds,
        access_token: data.access_token,
        access_token_expiry: newExpiry,
      },
    })
    .eq("id", account.id);

  return data.access_token as string;
}
