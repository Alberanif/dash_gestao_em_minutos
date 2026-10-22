import { resolveAccountRole } from "@/types/auth";

/**
 * Destino de redirecionamento para quem não pode ver o V2, ou null se pode.
 * Mesma regra do guarda do V1 (`indicadores/layout.tsx`).
 */
export function v2AccessRedirect(
  user: { app_metadata?: object } | null,
): string | null {
  if (!user) return "/login";
  const role = resolveAccountRole((user.app_metadata as { role?: unknown } | undefined)?.role);
  if (role === "pendente") return "/aguardando-aprovacao";
  if (role === "comum") return "/base-de-dados";
  return null;
}
