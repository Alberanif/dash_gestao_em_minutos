import { deriveSourceFlags } from "../source-flags";
import type { FilterRecord } from "@/types/indicadores";

const base: FilterRecord = {
  id: "1",
  account_id: "acc",
  name: "test",
  hotmart_products: [],
  meta_ads_terms: [],
  captacao_leads_eventos: [],
  created_at: "",
  updated_at: "",
};

describe("deriveSourceFlags — hasLeadsFilter", () => {
  it("is false when captacao_leads_eventos is empty", () => {
    const flags = deriveSourceFlags({ ...base, captacao_leads_eventos: [] });
    expect(flags.hasLeadsFilter).toBe(false);
  });

  it("is true when captacao_leads_eventos has at least one event", () => {
    const flags = deriveSourceFlags({ ...base, captacao_leads_eventos: ["Inscricao Webinar"] });
    expect(flags.hasLeadsFilter).toBe(true);
  });

  it("is true when captacao_leads_eventos has multiple events", () => {
    const flags = deriveSourceFlags({ ...base, captacao_leads_eventos: ["Evento A", "Evento B"] });
    expect(flags.hasLeadsFilter).toBe(true);
  });
});
