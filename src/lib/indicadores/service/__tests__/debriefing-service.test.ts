import { fetchDebriefingMetrics } from "../debriefing";

describe("fetchDebriefingMetrics", () => {
  const mockSales = [
    {
      product_id: "p1",
      product_name: "Produto Principal",
      price: 500,
      currency: "BRL",
      purchase_date: "2026-05-10T12:00:00.000Z",
      offer_code: "OFR_1",
      offer_name: "Oferta Padrão",
    },
    {
      product_id: "p1",
      product_name: "Produto Principal",
      price: 1000,
      currency: "BRL",
      purchase_date: "2026-05-10T15:00:00.000Z",
      offer_code: "OFR_1",
      offer_name: "Oferta Padrão",
    },
    {
      product_id: "p1",
      product_name: "Produto Principal",
      price: 150,
      currency: "USD",
      purchase_date: "2026-05-11T10:00:00.000Z",
      offer_code: "OFR_INT",
      offer_name: "Oferta Internacional",
    },
  ];

  const mockSupabase = {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        in: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: mockSales,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };

  it("calcula corretamente métricas de vendas, faturamento e desdobramento por oferta", async () => {
    const res = await fetchDebriefingMetrics(
      { startDate: "2026-05-01", endDate: "2026-05-15", productId: "p1" },
      mockSupabase as any
    );

    expect(res.product_id).toBe("p1");
    expect(res.product_name).toBe("Produto Principal");
    expect(res.total_sales).toBe(3);
    expect(res.total_sales_brl).toBe(2);
    expect(res.total_sales_foreign).toBe(1);
    expect(res.total_revenue_brl).toBe(1500);

    expect(res.available_offers.length).toBe(2);
    expect(res.offers_breakdown.length).toBe(2);
    expect(res.offers_breakdown[0].offer_code).toBe("OFR_1");
    expect(res.offers_breakdown[0].sales_count).toBe(2);
    expect(res.offers_breakdown[0].revenue).toBe(1500);
  });

  it("filtra as métricas quando offerCodes é fornecido", async () => {
    const res = await fetchDebriefingMetrics(
      { startDate: "2026-05-01", endDate: "2026-05-15", productId: "p1", offerCodes: ["OFR_INT"] },
      mockSupabase as any
    );

    expect(res.total_sales).toBe(1);
    expect(res.total_sales_foreign).toBe(1);
    expect(res.total_sales_brl).toBe(0);
    expect(res.available_offers.length).toBe(2); // Todas as ofertas continuam listadas nas ofertas disponíveis
    expect(res.offers_breakdown.length).toBe(1);
    expect(res.offers_breakdown[0].offer_code).toBe("OFR_INT");
  });
});
