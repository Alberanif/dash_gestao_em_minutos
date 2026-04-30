import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/types/auth";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (
    !user &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/api/cron") &&
    !pathname.startsWith("/api/auth/youtube/callback")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const role = (user.app_metadata?.role as UserRole) ?? "gestor";

    if (role === "comum") {
      // Block Comum from dashboard and indicadores UI
      if (
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/indicadores")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/base-de-dados";
        return NextResponse.redirect(url);
      }

      // Block Comum from all API routes except base-de-dados
      if (
        pathname.startsWith("/api/") &&
        !pathname.startsWith("/api/base-de-dados/")
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  return supabaseResponse;
}
