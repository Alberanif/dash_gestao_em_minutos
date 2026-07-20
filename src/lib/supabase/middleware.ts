import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { AccountRole } from "@/types/auth";

/** Única página acessível a uma conta aguardando aprovação do gestor. */
const PENDING_PATH = "/aguardando-aprovacao";

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

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Network error (e.g. Supabase unreachable) — treat as unauthenticated
  }

  const pathname = request.nextUrl.pathname;

  if (
    !user &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/cadastro") &&
    !pathname.startsWith("/api/auth/signup") &&
    !pathname.startsWith("/api/cron") &&
    !pathname.startsWith("/api/auth/youtube/callback")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Fallback seguro: role ausente ou desconhecida vale como `pendente` (bloqueio),
    // nunca como `gestor`.
    const role = (user.app_metadata?.role as AccountRole) ?? "pendente";

    if (role === "pendente") {
      // Nenhuma API de negócio é liberada; só o signout, para a pessoa poder sair.
      if (pathname.startsWith("/api/")) {
        if (!pathname.startsWith("/api/auth/signout")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else if (pathname !== PENDING_PATH) {
        const url = request.nextUrl.clone();
        url.pathname = PENDING_PATH;
        return NextResponse.redirect(url);
      }
    }

    // Conta já ativa não tem o que fazer na página de espera.
    if (role !== "pendente" && pathname === PENDING_PATH) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

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
