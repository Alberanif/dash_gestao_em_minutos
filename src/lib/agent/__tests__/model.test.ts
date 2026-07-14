import { resolveAgentModel, DEFAULT_AGENT_MODEL } from "../model";

describe("resolveAgentModel", () => {
  it("usa o modelo definido em AGENT_MODEL", () => {
    expect(resolveAgentModel({ AGENT_MODEL: "gpt-5" })).toBe("gpt-5");
  });

  it("cai no modelo padrão quando AGENT_MODEL não está definida", () => {
    expect(resolveAgentModel({})).toBe(DEFAULT_AGENT_MODEL);
  });

  it("cai no modelo padrão quando AGENT_MODEL está vazia ou só com espaços", () => {
    expect(resolveAgentModel({ AGENT_MODEL: "" })).toBe(DEFAULT_AGENT_MODEL);
    expect(resolveAgentModel({ AGENT_MODEL: "   " })).toBe(DEFAULT_AGENT_MODEL);
  });

  it("ignora espaços ao redor do nome do modelo", () => {
    expect(resolveAgentModel({ AGENT_MODEL: "  gpt-4.1-mini  " })).toBe("gpt-4.1-mini");
  });

  it("abandona o gpt-4o-mini como padrão", () => {
    expect(DEFAULT_AGENT_MODEL).not.toBe("gpt-4o-mini");
  });
});
