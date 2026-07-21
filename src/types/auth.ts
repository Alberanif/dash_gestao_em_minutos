// src/types/auth.ts
export type UserRole = 'gestor' | 'analista' | 'comum'

/**
 * Estado bruto da conta, lido de `app_metadata.role`.
 * `pendente` não é uma role de acesso — é o estado de uma conta que aguarda
 * aprovação do gestor, e o fallback seguro quando a role está ausente.
 */
export type AccountRole = UserRole | 'pendente'

const ACCOUNT_ROLES: readonly AccountRole[] = ['gestor', 'analista', 'comum', 'pendente']

/**
 * Interpreta o valor bruto de `app_metadata.role`.
 *
 * `app_metadata` é dado externo — vem do Supabase e pode ter sido escrito à mão
 * no painel. Um cast (`as AccountRole`) apenas silencia o compilador e deixa um
 * valor arbitrário atravessar as checagens de acesso: uma role inventada não
 * casa com `"pendente"` nem com `"comum"`, escapando dos dois bloqueios.
 *
 * Aqui o default é sempre `pendente` (bloqueio): tanto para role ausente quanto
 * para qualquer valor fora da lista conhecida. Nunca `gestor`.
 */
export function resolveAccountRole(raw: unknown): AccountRole {
  return typeof raw === 'string' && (ACCOUNT_ROLES as readonly string[]).includes(raw)
    ? (raw as AccountRole)
    : 'pendente'
}
