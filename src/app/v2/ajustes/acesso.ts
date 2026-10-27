import { resolveAccountRole } from "@/types/auth";
import { v2AccessRedirect } from "../access";

/**
 * Destino de redirecionamento para quem não pode abrir Ajustes, ou null se pode. Vale a regra do V2
 * (login, aprovação pendente) e, além dela, só gestor e analista entram, como em /ajustes no V1.
 */
export function ajustesAccessRedirect(user: { app_metadata?: object } | null): string | null {
  const base = v2AccessRedirect(user);
  if (base) return base;
  const role = resolveAccountRole((user?.app_metadata as { role?: unknown } | undefined)?.role);
  return role === "gestor" || role === "analista" ? null : "/v2";
}
