// src/types/auth.ts
/** Papéis que o gestor pode atribuir. Só existem estes dois; `analista` vê tudo, exceto Configurações. */
export type UserRole = 'gestor' | 'analista'

/**
 * Papel legado, em extinção. Contas antigas ainda podem trazê-lo em `app_metadata.role` até a migração
 * para `analista` ser aplicada; nada novo o atribui. Mantém as restrições de antes (só Base de Dados)
 * para a migração não abrir acesso por acidente. Será removido depois da migração.
 */
export type LegacyRole = 'comum'

/** Papel de uma conta ativa (nunca `pendente`), incluindo o legado. */
export type ActiveRole = UserRole | LegacyRole

/**
 * Estado bruto da conta, lido de `app_metadata.role`.
 * `pendente` não é uma role de acesso — é o estado de uma conta que aguarda
 * aprovação do gestor, e o fallback seguro quando a role está ausente.
 */
export type AccountRole = ActiveRole | 'pendente'

const ACCOUNT_ROLES: readonly AccountRole[] = ['gestor', 'analista', 'comum', 'pendente']

/** Papéis que a API aceita atribuir (criar, trocar, aprovar). `comum` não é mais atribuível. */
export const ASSIGNABLE_ROLES: readonly UserRole[] = ['gestor', 'analista']

/** Configurações e gestão de usuários: a única diferença entre gestor e analista. */
export function canManageSettings(role: AccountRole): boolean {
  return role === 'gestor'
}

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
