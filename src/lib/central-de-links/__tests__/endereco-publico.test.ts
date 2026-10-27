import { enderecoPublico } from "../endereco-publico";

describe("enderecoPublico", () => {
  it("usa o slug quando existe", () => {
    expect(enderecoPublico("https://app.igt.com", { id: "uuid-1", slug: "captacao-outubro" })).toBe(
      "https://app.igt.com/p/captacao-outubro",
    );
  });

  it("cai para o id quando não há slug", () => {
    expect(enderecoPublico("https://app.igt.com", { id: "uuid-1", slug: null })).toBe("https://app.igt.com/p/uuid-1");
  });

  it("slug vazio também cai para o id", () => {
    expect(enderecoPublico("http://localhost:3000", { id: "abc", slug: "" })).toBe("http://localhost:3000/p/abc");
  });
});
