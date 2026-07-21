import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * `admin.listUsers()` sem argumentos devolve apenas a primeira página (50 por
 * padrão) e não sinaliza de forma alguma que houve corte — a resposta de uma
 * base com 40 contas é indistinguível da de uma base com 4000. Quem contasse
 * ou listasse direto a partir dela erraria em silêncio assim que o projeto
 * passasse do tamanho de uma página.
 */
const PER_PAGE = 200;

/**
 * Teto de segurança. Um backend que sempre devolve página cheia prenderia o
 * handler num laço infinito; abortar com erro é preferível a truncar calado,
 * que é exatamente o defeito que este helper existe para corrigir.
 */
const MAX_PAGES = 50;

/**
 * Percorre todas as páginas de `auth.admin.listUsers` e devolve a lista
 * completa. Em caso de falha devolve lista vazia e a mensagem — nunca um
 * resultado parcial, que o chamador não teria como distinguir do total.
 */
export async function listAllUsers(
  supabase: SupabaseClient
): Promise<{ users: User[]; error: string | null }> {
  const users: User[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });

    if (error) return { users: [], error: error.message };

    users.push(...data.users);

    if (data.users.length < PER_PAGE) return { users, error: null };
  }

  return {
    users: [],
    error: `paginação de usuários excedeu ${MAX_PAGES} páginas (${MAX_PAGES * PER_PAGE} contas)`,
  };
}
