import type { VendasScreen } from "@/components/vendas/vendas-screen";

// VendasPage é Server Component assíncrono: não passa por render() do
// Testing Library, então chamamos a função diretamente e inspecionamos o
// elemento JSX que ela devolve.

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

  mockGetUser.mockResolvedValue({
    data: { user: { app_metadata: { role: "gestor" } } },
  });

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

describe("VendasPage — query de produtos alimenta a tela", () => {
  it("pede account_id ao Supabase e repassa produtos e papel para VendasScreen", async () => {
    const VendasPage = (await import("../page")).default;

    const element = await VendasPage();

    // O client Supabase é destipado: tirar account_id da string do .select()
    // não quebra tipo nenhum — só este teste pega.
    expect(mockFrom).toHaveBeenCalledWith("dash_gestao_hotmart_products");
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("account_id"));

    const screenElement = element as unknown as {
      type: typeof VendasScreen;
      props: { role: string; products: { product_id: string; account_id: string }[] };
    };
    expect(screenElement.props.role).toBe("gestor");
    expect(screenElement.props.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ product_id: "p1", account_id: "acc-1" }),
        expect.objectContaining({ product_id: "p2", account_id: "acc-1" }),
      ])
    );
  });

  it("sem sessão redireciona para /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    const VendasPage = (await import("../page")).default;
    await expect(VendasPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
