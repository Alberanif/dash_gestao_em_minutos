import { canManageSettings, resolveAccountRole } from "@/types/auth";
import { v2AccessRedirect } from "../access";

/**
 * Destino de redirecionamento para quem não pode abrir Ajustes, ou null se pode. Vale a regra do V2
 * (login, aprovação pendente) e, além dela, só o gestor entra: Configurações e gestão de usuários são a única diferença entre gestor e analista.
 */
export function ajustesAccessRedirect(user: { app_metadata?: object } | null): string | null {
  const base = v2AccessRedirect(user);
  if (base) return base;
  const role = resolveAccountRole((user?.app_metadata as { role?: unknown } | undefined)?.role);
  return canManageSettings(role) ? null : "/v2";
}
