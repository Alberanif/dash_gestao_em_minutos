import type { TelaDeVendas } from "@/components/v2/vendas/tela-de-vendas";

// A página é um Server Component assíncrono: chamamos a função direto e
// inspecionamos o elemento JSX devolvido.

const mockGetUser = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockRedirect = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

jest.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRedirect.mockImplementation((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  });
  mockGetUser.mockResolvedValue({ data: { user: { app_metadata: { role: "gestor" } } } });
  mockEq.mockResolvedValue({
    data: [
      { product_id: "p1", product_name: "Produto Um", account_id: "acc-1" },
      { product_id: "p2", product_name: "Produto Dois", account_id: "acc-1" },
    ],
    error: null,
  });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
});

describe("página do Relatório de vendas na V2", () => {
  it("pede account_id ao Supabase e repassa produtos e papel à tela", async () => {
    const Pagina = (await import("../page")).default;
    const element = await Pagina();

    // O client Supabase é destipado: tirar account_id da string do .select()
    // não quebra tipo nenhum, só este teste pega.
    expect(mockFrom).toHaveBeenCalledWith("dash_gestao_hotmart_products");
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("account_id"));

    const tela = element as unknown as {
      type: typeof TelaDeVendas;
      props: { role: string; products: { product_id: string; account_id: string }[] };
    };
    expect(tela.props.role).toBe("gestor");
    expect(tela.props.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ product_id: "p1", account_id: "acc-1" }),
        expect.objectContaining({ product_id: "p2", account_id: "acc-1" }),
      ]),
    );
  });

  it("sem sessão redireciona para /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const Pagina = (await import("../page")).default;
    await expect(Pagina()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("papel pendente vai para a aprovação e papel comum para a base de dados", async () => {
    const Pagina = (await import("../page")).default;

    mockGetUser.mockResolvedValue({ data: { user: { app_metadata: { role: "pendente" } } } });
    await expect(Pagina()).rejects.toThrow("NEXT_REDIRECT:/aguardando-aprovacao");

    mockGetUser.mockResolvedValue({ data: { user: { app_metadata: { role: "comum" } } } });
    await expect(Pagina()).rejects.toThrow("NEXT_REDIRECT:/base-de-dados");
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
