/**
 * Papel de uma pessoa dentro da Central de Links, lido de `app_metadata.central_role`.
 * `admin` edita, `membro` só lê, ausente/desconhecido = sem acesso (null).
 * É independente do `role` geral (gestor/analista): as políticas RLS do banco
 * (`eh_admin()`/`eh_membro()`) leem exatamente esta chave.
 */
export type PapelCentral = "admin" | "membro";

export const PAPEIS_CENTRAL: readonly PapelCentral[] = ["admin", "membro"];

/** Interpreta o valor bruto (dado externo): qualquer coisa fora da lista vira null. */
export function resolverPapelCentral(bruto: unknown): PapelCentral | null {
  return typeof bruto === "string" && (PAPEIS_CENTRAL as readonly string[]).includes(bruto)
    ? (bruto as PapelCentral)
    : null;
}

export function papelDoUsuario(user: { app_metadata?: object } | null | undefined): PapelCentral | null {
  return resolverPapelCentral((user?.app_metadata as { central_role?: unknown } | undefined)?.central_role);
}

/** Ler a Central exige qualquer papel. */
export function podeVer(papel: PapelCentral | null): boolean {
  return papel !== null;
}

/** Escrever (criar, editar, excluir, arquivar, gerir testes) exige admin. */
export function podeEditar(papel: PapelCentral | null): boolean {
  return papel === "admin";
}
