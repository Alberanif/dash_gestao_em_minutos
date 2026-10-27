import { v2AccessRedirect } from "../access";

describe("v2AccessRedirect", () => {
  it("sem sessão vai para /login", () => {
    expect(v2AccessRedirect(null)).toBe("/login");
  });

  it("conta pendente vai para /aguardando-aprovacao", () => {
    expect(v2AccessRedirect({ app_metadata: { role: "pendente" } })).toBe("/aguardando-aprovacao");
  });

  it("role ausente ou inventada cai em pendente", () => {
    expect(v2AccessRedirect({ app_metadata: {} })).toBe("/aguardando-aprovacao");
    expect(v2AccessRedirect({ app_metadata: { role: "admin" } })).toBe("/aguardando-aprovacao");
  });

  it("comum vai para /base-de-dados", () => {
    expect(v2AccessRedirect({ app_metadata: { role: "comum" } })).toBe("/base-de-dados");
  });

  it("gestor e analista passam", () => {
    expect(v2AccessRedirect({ app_metadata: { role: "gestor" } })).toBeNull();
    expect(v2AccessRedirect({ app_metadata: { role: "analista" } })).toBeNull();
  });
});
