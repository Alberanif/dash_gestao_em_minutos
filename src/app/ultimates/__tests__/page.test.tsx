import type { UltimatesScreen } from "@/components/ultimates/ultimates-screen";

// UltimatesPage é Server Component assíncrono: não passa por render() do
// Testing Library (que não resolve Server Components), então chamamos a
// função diretamente e inspecionamos o elemento JSX que ela devolve.

const mockGetUser = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// next/navigation.redirect lança de verdade em runtime (interrompe o RSC).
// Aqui role é sempre "gestor", então nenhum caminho do teste deveria chamá-lo
// — mas deixamos mockado (sem lançar) para não quebrar caso algo mude.
jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
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

describe("UltimatesPage — query de produtos alimenta a trava de conta", () => {
  it("pede account_id ao Supabase e repassa o campo para UltimatesScreen", async () => {
    const UltimatesPage = (await import("../page")).default;

    const element = await UltimatesPage();

    // O modal "Novo ciclo" só trava a seleção numa única conta Hotmart porque
    // account_id chega na query. Tirar o campo da string do .select() não
    // quebra tipo nenhum (client Supabase é destipado) — só este teste pega.
    expect(mockFrom).toHaveBeenCalledWith("dash_gestao_hotmart_products");
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("account_id"));

    // E precisa mesmo chegar até a tela, não só na query.
    const screenElement = element as unknown as {
      type: typeof UltimatesScreen;
      props: { products: { product_id: string; account_id: string }[] };
    };
    expect(screenElement.props.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ product_id: "p1", account_id: "acc-1" }),
        expect.objectContaining({ product_id: "p2", account_id: "acc-1" }),
      ])
    );
  });
});
