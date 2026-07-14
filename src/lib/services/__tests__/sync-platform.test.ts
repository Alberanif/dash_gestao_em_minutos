jest.mock("@/lib/services/youtube", () => ({
  collectYouTube: jest.fn(),
}));

jest.mock("@/lib/services/instagram", () => ({
  collectInstagramDaily: jest.fn(),
}));

jest.mock("@/lib/services/meta-ads", () => ({
  collectMetaAds: jest.fn(),
}));

jest.mock("@/lib/services/hotmart", () => ({
  collectHotmart: jest.fn(),
}));

import { collectYouTube } from "@/lib/services/youtube";
import { collectInstagramDaily } from "@/lib/services/instagram";
import { collectMetaAds } from "@/lib/services/meta-ads";
import { collectHotmart } from "@/lib/services/hotmart";

const mockInsert = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

function makeSupabase() {
  mockInsert.mockResolvedValue({ error: null });
  mockEq.mockReturnValue({ eq: mockEq2 });
  const mockEq2 = jest.fn().mockResolvedValue({ data: [], error: null });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockImplementation((table: string) => {
    if (table === "dash_gestao_cron_logs") {
      return { insert: mockInsert };
    }
    return { select: mockSelect };
  });
  return { from: mockFrom } as unknown as ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceClient>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("syncPlatform — error handling", () => {
  it("returns error status when collector throws and logs with status error", async () => {
    const account = { id: "acc-4", name: "Failing Channel", platform: "youtube", is_active: true, credentials: {}, created_at: "" };

    const mockEqChain = jest.fn().mockResolvedValue({ data: [account], error: null });
    const mockEqFirst = jest.fn().mockReturnValue({ eq: mockEqChain });
    const mockSelectChain = jest.fn().mockReturnValue({ eq: mockEqFirst });
    mockFrom.mockImplementation((table: string) => {
      if (table === "dash_gestao_accounts") return { select: mockSelectChain };
      if (table === "dash_gestao_cron_logs") return { insert: mockInsert };
      return {};
    });
    mockInsert.mockResolvedValue({ error: null });

    (collectYouTube as jest.Mock).mockRejectedValue(new Error("timeout"));

    const { syncPlatform } = await import("../sync-platform");
    const supabase = { from: mockFrom } as unknown as ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceClient>;

    const results = await syncPlatform("youtube", supabase);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ account_id: "acc-4", account_name: "Failing Channel", status: "error", error: "timeout" });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "error", error_message: "timeout" }));
  });
});

describe("syncPlatform — meta-ads", () => {
  it("returns success with records = dailyRecords + campaignDailyRecords", async () => {
    const account = { id: "acc-3", name: "My Meta Ads", platform: "meta-ads", is_active: true, credentials: {}, created_at: "" };

    const mockEqChain = jest.fn().mockResolvedValue({ data: [account], error: null });
    const mockEqFirst = jest.fn().mockReturnValue({ eq: mockEqChain });
    const mockSelectChain = jest.fn().mockReturnValue({ eq: mockEqFirst });
    mockFrom.mockImplementation((table: string) => {
      if (table === "dash_gestao_accounts") return { select: mockSelectChain };
      if (table === "dash_gestao_cron_logs") return { insert: mockInsert };
      return {};
    });
    mockInsert.mockResolvedValue({ error: null });

    (collectMetaAds as jest.Mock).mockResolvedValue({ dailyRecords: 2, campaignDailyRecords: 3 });

    const { syncPlatform } = await import("../sync-platform");
    const supabase = { from: mockFrom } as unknown as ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceClient>;

    const results = await syncPlatform("meta-ads", supabase);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ account_id: "acc-3", account_name: "My Meta Ads", status: "success", records: 5 });
  });
});

describe("syncPlatform — hotmart", () => {
  it("returns success with records = salesRecords, collecting a 3-day window", async () => {
    const account = { id: "acc-5", name: "IGT Hotmart", platform: "hotmart", is_active: true, credentials: {}, created_at: "" };

    const mockEqChain = jest.fn().mockResolvedValue({ data: [account], error: null });
    const mockEqFirst = jest.fn().mockReturnValue({ eq: mockEqChain });
    const mockSelectChain = jest.fn().mockReturnValue({ eq: mockEqFirst });
    mockFrom.mockImplementation((table: string) => {
      if (table === "dash_gestao_accounts") return { select: mockSelectChain };
      if (table === "dash_gestao_cron_logs") return { insert: mockInsert };
      return {};
    });
    mockInsert.mockResolvedValue({ error: null });

    (collectHotmart as jest.Mock).mockResolvedValue({ salesRecords: 92 });

    const { syncPlatform } = await import("../sync-platform");
    const supabase = { from: mockFrom } as unknown as ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceClient>;

    const results = await syncPlatform("hotmart", supabase);

    expect(collectHotmart).toHaveBeenCalledWith(account, {
      startDate: expect.any(Date),
      endDate: expect.any(Date),
    });

    const { startDate, endDate } = (collectHotmart as jest.Mock).mock.calls[0][1];
    const windowDays = (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
    expect(windowDays).toBeCloseTo(3);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ account_id: "acc-5", account_name: "IGT Hotmart", status: "success", records: 92 });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "success", records_collected: 92 }));
  });
});

describe("syncPlatform — plataforma sem coletor", () => {
  it("logs an error instead of a silent success with 0 records", async () => {
    const account = { id: "acc-6", name: "Sem Coletor", platform: "tiktok", is_active: true, credentials: {}, created_at: "" };

    const mockEqChain = jest.fn().mockResolvedValue({ data: [account], error: null });
    const mockEqFirst = jest.fn().mockReturnValue({ eq: mockEqChain });
    const mockSelectChain = jest.fn().mockReturnValue({ eq: mockEqFirst });
    mockFrom.mockImplementation((table: string) => {
      if (table === "dash_gestao_accounts") return { select: mockSelectChain };
      if (table === "dash_gestao_cron_logs") return { insert: mockInsert };
      return {};
    });
    mockInsert.mockResolvedValue({ error: null });

    const { syncPlatform } = await import("../sync-platform");
    const supabase = { from: mockFrom } as unknown as ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceClient>;

    const results = await syncPlatform("tiktok", supabase);

    expect(results[0]).toMatchObject({ status: "error" });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", error_message: expect.stringContaining("tiktok") })
    );
    expect(mockInsert).not.toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
  });
});

describe("syncPlatform — instagram", () => {
  it("returns success with records = profileRecords + mediaRecords", async () => {
    const account = { id: "acc-2", name: "My Instagram", platform: "instagram", is_active: true, credentials: {}, created_at: "" };

    const mockEqChain = jest.fn().mockResolvedValue({ data: [account], error: null });
    const mockEqFirst = jest.fn().mockReturnValue({ eq: mockEqChain });
    const mockSelectChain = jest.fn().mockReturnValue({ eq: mockEqFirst });
    mockFrom.mockImplementation((table: string) => {
      if (table === "dash_gestao_accounts") return { select: mockSelectChain };
      if (table === "dash_gestao_cron_logs") return { insert: mockInsert };
      return {};
    });
    mockInsert.mockResolvedValue({ error: null });

    (collectInstagramDaily as jest.Mock).mockResolvedValue({ profileRecords: 1, mediaRecords: 4 });

    const { syncPlatform } = await import("../sync-platform");
    const supabase = { from: mockFrom } as unknown as ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceClient>;

    const results = await syncPlatform("instagram", supabase);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ account_id: "acc-2", account_name: "My Instagram", status: "success", records: 5 });
  });
});

describe("syncPlatform — youtube", () => {
  it("returns success with records = channelRecords + videoRecords", async () => {
    const account = { id: "acc-1", name: "My Channel", platform: "youtube", is_active: true, credentials: {}, created_at: "" };

    const mockEqChain = jest.fn().mockResolvedValue({ data: [account], error: null });
    const mockEqFirst = jest.fn().mockReturnValue({ eq: mockEqChain });
    const mockSelectChain = jest.fn().mockReturnValue({ eq: mockEqFirst });
    mockFrom.mockImplementation((table: string) => {
      if (table === "dash_gestao_accounts") return { select: mockSelectChain };
      if (table === "dash_gestao_cron_logs") return { insert: mockInsert };
      return {};
    });
    mockInsert.mockResolvedValue({ error: null });

    (collectYouTube as jest.Mock).mockResolvedValue({ channelRecords: 1, videoRecords: 2, analyticsError: undefined });

    const { syncPlatform } = await import("../sync-platform");
    const supabase = { from: mockFrom } as unknown as ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceClient>;

    const results = await syncPlatform("youtube", supabase);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ account_id: "acc-1", account_name: "My Channel", status: "success", records: 3 });
  });
});
