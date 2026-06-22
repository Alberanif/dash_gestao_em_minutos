import { calculateAdsComercialMetrics } from "../ads-comercial";
import type { ConviteAdsComercialConfig } from "@/types/convite";

const mockRpc = jest.fn();
const mockFrom = jest.fn();

function makeSupabase() {
  return { rpc: mockRpc, from: mockFrom } as ReturnType<
    typeof import("@/lib/supabase/server").createSupabaseServiceClient
  >;
}

const baseConfig: ConviteAdsComercialConfig = {
  hotmart_account_id: "acc-1",
  hotmart_product_ids: ["prod-1"],
  meta_ads_account_ids: ["meta-1"],
  campaign_terms: ["term1"],
  organic_lead_events: ["Inscricao Webinar"],
};

const baseProject = {
  id: "proj-1",
  data_inicio: "2025-01-01",
  data_fim: "2025-01-31",
};

function makeFromChain(data: unknown, error: null | { message: string } = null) {
  const result = { data, error };
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    limit: jest.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  chain.limit.mockResolvedValue(result);
  // Thenable so the chain resolves when awaited at any point in the call sequence
  (chain as unknown as { then: Function }).then = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("calculateAdsComercialMetrics — organic leads deduplication", () => {
  it("calls dash_gestao_organic_leads_unique_count RPC for organic leads", async () => {
    mockFrom.mockReturnValue(makeFromChain([]));
    mockRpc.mockResolvedValue({ data: 7, error: null });

    const supabase = makeSupabase();
    await calculateAdsComercialMetrics(supabase, baseProject, baseConfig);

    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_organic_leads_unique_count", {
      p_start_date: expect.any(String),
      p_end_date: expect.any(String),
      p_eventos: baseConfig.organic_lead_events,
    });
  });

  it("returns organic_leads from the RPC unique count", async () => {
    mockFrom.mockReturnValue(makeFromChain([]));
    mockRpc.mockResolvedValue({ data: 15, error: null });

    const supabase = makeSupabase();
    const result = await calculateAdsComercialMetrics(supabase, baseProject, baseConfig);

    expect(result?.organic_leads).toBe(15);
  });

  it("counts each unique email once even when two queries would have returned duplicates", async () => {
    mockFrom.mockReturnValue(makeFromChain([]));
    mockRpc.mockResolvedValue({ data: 10, error: null });

    const supabase = makeSupabase();
    const result = await calculateAdsComercialMetrics(supabase, baseProject, baseConfig);

    expect(result?.organic_leads).toBe(10);
    const organicRpcCalls = (mockRpc.mock.calls as [string, unknown][]).filter(
      ([fn]) => fn === "dash_gestao_organic_leads_unique_count"
    );
    expect(organicRpcCalls).toHaveLength(1);
  });
});
