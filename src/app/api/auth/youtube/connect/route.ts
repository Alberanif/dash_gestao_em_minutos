// src/app/api/auth/youtube/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildOAuthUrl } from "@/lib/youtube/auth";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id obrigatório" }, { status: 400 });
  }

  // Verify this account exists and is a YouTube account
  const supabase = createSupabaseServiceClient();
  const { data: account } = await supabase
    .from("dash_gestao_accounts")
    .select("id, platform")
    .eq("id", accountId)
    .eq("platform", "youtube")
    .maybeSingle();

  if (!account) {
    return NextResponse.json(
      { error: "Conta YouTube não encontrada" },
      { status: 404 }
    );
  }

  // Generate HMAC state for CSRF protection (reuses CRON_SECRET as signing key)
  const state = createHmac("sha256", process.env.CRON_SECRET!)
    .update(accountId)
    .digest("hex");

  const oauthUrl = buildOAuthUrl(accountId, state);

  // Store account_id in a short-lived httpOnly cookie for the callback
  const response = NextResponse.redirect(oauthUrl);
  response.cookies.set("yt_oauth_account_id", accountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes
    sameSite: "lax", // must be lax (not strict) for top-level redirects from Google
    path: "/",
  });
  return response;
}
