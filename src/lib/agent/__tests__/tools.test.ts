import {
  getMetaAdsMetrics,
  getHotmartMetrics,
  getLeadsMetrics,
  getDailySeries,
} from "../tools";
import type { GlobalMetrics, GlobalHotmartMetrics, GlobalLeadsMetrics, DailyPoint } from "@/types/indicadores";

const params = { startDate: "2026-05-01", endDate: "2026-05-31", filterId: "filter-abc" };
const authHeaders = { Authorization: "Bearer token-xyz", "x-account-id": "acc-1" };

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function makeErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: "Not found" }),
  } as unknown as Response;
}

describe("getMetaAdsMetrics", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  it("faz fetch para URL correta com params corretos", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({}));
    await getMetaAdsMetrics(params, authHeaders);

    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("/api/indicadores/metrics");
    expect(url).toContain("start_date=2026-05-01");
    expect(url).toContain("end_date=2026-05-31");
    expect(url).toContain("filter_id=filter-abc");
  });

  it("repassa authHeaders no fetch", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({}));
    await getMetaAdsMetrics(params, authHeaders);

    const options = mockFetch.mock.calls[0][1];
    expect(options.headers).toMatchObject(authHeaders);
  });

  it("retorna dados parseados do JSON quando status ok", async () => {
    const mockData: GlobalMetrics = {
      meta_spend: 999,
      meta_cpm: 5,
      meta_ctr: 0.01,
      meta_leads: 200,
      meta_checkout: 40,
      meta_impressions: 50000,
      meta_link_clicks: 1000,
      meta_page_views: 900,
      meta_connect_rate: null,
      meta_lp_conversion: null,
      meta_cpl_traffic: 4.99,
    };
    mockFetch.mockResolvedValueOnce(makeOkResponse(mockData));
    const result = await getMetaAdsMetrics(params, authHeaders);
    expect(result).toEqual(mockData);
  });

  it("lança Error com mensagem descritiva quando status >= 400", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(404));
    await expect(getMetaAdsMetrics(params, authHeaders)).rejects.toThrow(/meta.?ads/i);
  });
});

describe("getHotmartMetrics", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  it("faz fetch para URL correta com params corretos", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({}));
    await getHotmartMetrics(params, authHeaders);

    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("/api/indicadores/hotmart");
    expect(url).toContain("start_date=2026-05-01");
    expect(url).toContain("end_date=2026-05-31");
    expect(url).toContain("filter_id=filter-abc");
  });

  it("repassa authHeaders no fetch", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({}));
    await getHotmartMetrics(params, authHeaders);

    const options = mockFetch.mock.calls[0][1];
    expect(options.headers).toMatchObject(authHeaders);
  });

  it("retorna dados parseados do JSON quando status ok", async () => {
    const mockData: GlobalHotmartMetrics = {
      products: [],
      total_sales: 80,
      total_sales_brl: 70,
      total_sales_foreign: 10,
      total_revenue: 32000,
    };
    mockFetch.mockResolvedValueOnce(makeOkResponse(mockData));
    const result = await getHotmartMetrics(params, authHeaders);
    expect(result).toEqual(mockData);
  });

  it("lança Error com mensagem descritiva quando status >= 400", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500));
    await expect(getHotmartMetrics(params, authHeaders)).rejects.toThrow(/hotmart/i);
  });
});

describe("getLeadsMetrics", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  it("faz fetch para URL correta com params corretos", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({}));
    await getLeadsMetrics(params, authHeaders);

    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("/api/indicadores/leads");
    expect(url).toContain("start_date=2026-05-01");
    expect(url).toContain("end_date=2026-05-31");
    expect(url).toContain("filter_id=filter-abc");
  });

  it("repassa authHeaders no fetch", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({}));
    await getLeadsMetrics(params, authHeaders);

    const options = mockFetch.mock.calls[0][1];
    expect(options.headers).toMatchObject(authHeaders);
  });

  it("retorna dados parseados do JSON quando status ok", async () => {
    const mockData: GlobalLeadsMetrics = {
      total: 350,
      by_event: [{ evento: "PageView", count: 100 }],
      by_source: [{ source: "instagram", count: 200 }],
    };
    mockFetch.mockResolvedValueOnce(makeOkResponse(mockData));
    const result = await getLeadsMetrics(params, authHeaders);
    expect(result).toEqual(mockData);
  });

  it("lança Error com mensagem descritiva quando status >= 400", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(403));
    await expect(getLeadsMetrics(params, authHeaders)).rejects.toThrow(/leads/i);
  });
});

describe("getDailySeries", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  it("faz fetch para URL correta com params corretos", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([]));
    await getDailySeries(params, authHeaders);

    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("/api/indicadores/daily");
    expect(url).toContain("start_date=2026-05-01");
    expect(url).toContain("end_date=2026-05-31");
    expect(url).toContain("filter_id=filter-abc");
  });

  it("repassa authHeaders no fetch", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([]));
    await getDailySeries(params, authHeaders);

    const options = mockFetch.mock.calls[0][1];
    expect(options.headers).toMatchObject(authHeaders);
  });

  it("retorna dados parseados do JSON quando status ok", async () => {
    const mockData: DailyPoint[] = [
      {
        date: "2026-05-01",
        meta_spend: 50,
        meta_leads: 10,
        meta_cpl_traffic: 5,
        meta_checkout: 2,
        hotmart_sales: 3,
        lead_captacoes: 8,
      },
    ];
    mockFetch.mockResolvedValueOnce(makeOkResponse(mockData));
    const result = await getDailySeries(params, authHeaders);
    expect(result).toEqual(mockData);
  });

  it("lança Error com mensagem descritiva quando status >= 400", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(400));
    await expect(getDailySeries(params, authHeaders)).rejects.toThrow(/daily|série/i);
  });
});
