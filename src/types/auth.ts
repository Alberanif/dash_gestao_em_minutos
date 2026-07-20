// src/types/auth.ts
export type UserRole = 'gestor' | 'analista' | 'comum'

/**
 * Estado bruto da conta, lido de `app_metadata.role`.
 * `pendente` não é uma role de acesso — é o estado de uma conta que aguarda
 * aprovação do gestor, e o fallback seguro quando a role está ausente.
 */
export type AccountRole = UserRole | 'pendente'
