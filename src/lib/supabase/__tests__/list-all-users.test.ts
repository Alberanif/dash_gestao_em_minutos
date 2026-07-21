import { listAllUsers } from "../list-all-users";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Cliente mínimo: só o `auth.admin.listUsers` importa aqui. */
function clientWith(listUsers: jest.Mock): SupabaseClient {
  return { auth: { admin: { listUsers } } } as unknown as SupabaseClient;
}

/** Uma página com `size` usuários sintéticos. */
function page(size: number) {
  return {
    data: {
      users: Array.from({ length: size }, (_, i) => ({ id: `u-${i}` })),
    },
    error: null,
  };
}

describe("listAllUsers", () => {
  it("devolve os usuários quando tudo cabe em uma página", async () => {
    const listUsers = jest.fn().mockResolvedValue(page(3));

    const { users, error } = await listAllUsers(clientWith(listUsers));

    expect(error).toBeNull();
    expect(users).toHaveLength(3);
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  /**
   * O motivo de existir deste helper: `admin.listUsers()` sem argumentos
   * devolve só a primeira página e não sinaliza que houve corte. Quem chamasse
   * direto contaria pendentes a menos e sumiria com contas da fila de aprovação.
   */
  it("pagina até o fim quando há mais usuários que o tamanho da página", async () => {
    const listUsers = jest
      .fn()
      .mockResolvedValueOnce(page(200))
      .mockResolvedValueOnce(page(200))
      .mockResolvedValueOnce(page(50));

    const { users, error } = await listAllUsers(clientWith(listUsers));

    expect(error).toBeNull();
    expect(users).toHaveLength(450);
    expect(listUsers).toHaveBeenCalledTimes(3);
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 200 });
    expect(listUsers).toHaveBeenNthCalledWith(3, { page: 3, perPage: 200 });
  });

  it("para quando a página seguinte volta vazia", async () => {
    const listUsers = jest
      .fn()
      .mockResolvedValueOnce(page(200))
      .mockResolvedValueOnce(page(0));

    const { users, error } = await listAllUsers(clientWith(listUsers));

    expect(error).toBeNull();
    expect(users).toHaveLength(200);
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it("propaga o erro do Supabase sem devolver lista parcial", async () => {
    const listUsers = jest
      .fn()
      .mockResolvedValueOnce(page(200))
      .mockResolvedValueOnce({ data: { users: [] }, error: { message: "boom" } });

    const { users, error } = await listAllUsers(clientWith(listUsers));

    expect(error).toBe("boom");
    expect(users).toEqual([]);
  });

  /**
   * Um backend que sempre devolve página cheia (mock mal configurado, bug de
   * paginação) travaria o handler em laço infinito. Melhor falhar alto do que
   * truncar em silêncio — truncar aqui é justamente o bug que este helper corrige.
   */
  it("aborta com erro se a paginação não terminar, em vez de truncar calado", async () => {
    const listUsers = jest.fn().mockResolvedValue(page(200));

    const { users, error } = await listAllUsers(clientWith(listUsers));

    expect(users).toEqual([]);
    expect(error).toMatch(/paginação/i);
  });
});
