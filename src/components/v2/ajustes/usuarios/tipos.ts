import type { AccountRole, UserRole } from "@/types/auth";
import type { PapelCentral } from "@/lib/central-de-links/papel";
import type { TomDoSelo } from "../../ui";

export interface Usuario {
  id: string;
  email: string;
  name: string | null;
  role: AccountRole;
  /** Acesso à Central de Links; null = sem acesso. */
  central_role: PapelCentral | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export const ROTULO_FUNCAO: Record<UserRole, string> = {
  gestor: "Gestor",
  analista: "Analista",
  comum: "Comum",
};

export const TOM_FUNCAO: Record<UserRole, TomDoSelo> = {
  gestor: "info",
  analista: "ok",
  comum: "neutro",
};

export const OPCOES_FUNCAO = [
  { value: "comum", label: "Comum" },
  { value: "analista", label: "Analista" },
  { value: "gestor", label: "Gestor" },
];

export const ROTULO_ACESSO_CENTRAL: Record<PapelCentral | "nenhum", string> = {
  admin: "Admin",
  membro: "Membro",
  nenhum: "Sem acesso",
};

export const TOM_ACESSO_CENTRAL: Record<PapelCentral | "nenhum", TomDoSelo> = {
  admin: "info",
  membro: "ok",
  nenhum: "neutro",
};

/** O Select trabalha com texto; "nenhum" representa a ausência de papel (null na API). */
export const OPCOES_ACESSO_CENTRAL = [
  { value: "nenhum", label: "Sem acesso" },
  { value: "membro", label: "Membro" },
  { value: "admin", label: "Administrador" },
];

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Nome para citar a pessoa em confirmações: nome quando existe, senão e-mail. */
export function nomeDe(u: Usuario): string {
  return u.name || u.email;
}
