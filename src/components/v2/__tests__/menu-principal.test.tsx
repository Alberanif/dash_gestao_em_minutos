/** @jest-environment jsdom */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { CARTOES_DO_LAYOUT_ANTERIOR, MenuPrincipal, cartoesDoMenu } from "../menu-principal/menu-principal";
import { primeiroNome, saudacao } from "../menu-principal/saudacao";

describe("menu principal da V2", () => {
  it("gestor tem Indicadores, Central de links, Relatório de vendas, Configurações e Sair, nessa ordem", () => {
    expect(cartoesDoMenu("gestor").map((c) => c.titulo)).toEqual([
      "Indicadores",
      "Central de links",
      "Relatório de vendas",
      "Configurações",
      "Sair",
    ]);
  });

  it("analista não vê Configurações: só o gestor gerencia contas e usuários", () => {
    expect(cartoesDoMenu("analista").map((c) => c.titulo)).toEqual([
      "Indicadores",
      "Central de links",
      "Relatório de vendas",
      "Sair",
    ]);
    render(<MenuPrincipal saudacao="Bom dia" nome="Ana" role="analista" />);
    expect(screen.queryByRole("link", { name: /Configurações/ })).toBeNull();
    expect(document.querySelector('a[href="/v2/ajustes"]')).toBeNull();
  });

  it("gestor e analista veem as mesmas áreas de trabalho, V2 e layout anterior", () => {
    const hrefs = (role: "gestor" | "analista") => {
      const { container, unmount } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" role={role} />);
      const lista = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
      unmount();
      return lista.filter((h) => h !== "/v2/ajustes");
    };
    expect(hrefs("analista")).toEqual(hrefs("gestor"));
  });

  it("não há cartão nem link que leve de volta ao seletor antigo ou ao botão de escolher layout", () => {
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" role="gestor" />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/");
    expect(container.textContent).not.toMatch(/Layout V2/);
  });

  it("o Relatório de vendas abre a V2, sem selo V1, e o papel legado não o vê", () => {
    const cartao = cartoesDoMenu("gestor").find((c) => c.id === "relatorio-de-vendas")!;
    expect(cartao.href).toBe("/v2/relatorio-de-vendas");
    expect(cartao.selo).toBeUndefined();
    expect(cartao.tamanho).toBe("grande");
    expect(cartoesDoMenu("comum").map((c) => c.id)).not.toContain("relatorio-de-vendas");
    // Nenhum cartão do layout anterior aponta mais para ele.
    expect(CARTOES_DO_LAYOUT_ANTERIOR.map((c) => c.href)).not.toContain("/relatorio-de-vendas");
  });

  it("as áreas sem versão V2 abrem nos endereços de sempre, com selo V1, numa faixa à parte", () => {
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" role="gestor" />);
    const faixa = container.querySelector(".v2-menu-legado") as HTMLElement;
    expect(Array.from(faixa.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual([
      "/dashboard",
      "/base-de-dados",
    ]);
    expect(faixa.querySelectorAll(".v2-menu-selo")).toHaveLength(CARTOES_DO_LAYOUT_ANTERIOR.length);
    expect(faixa.textContent).toContain("V1");
    // Quem não tem destino em /v2 nunca aponta para dentro da V2 por engano.
    for (const c of CARTOES_DO_LAYOUT_ANTERIOR) expect(c.href).not.toMatch(/^\/v2/);
  });

  it("Indicadores, Central de links, Relatório de vendas e Configurações levam às suas telas da V2", () => {
    render(<MenuPrincipal saudacao="Bom dia" nome="Ana" role="gestor" />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/v2/indicadores",
      "/v2/central-de-links",
      "/v2/relatorio-de-vendas",
      "/v2/ajustes",
      "/dashboard",
      "/base-de-dados",
    ]);
  });

  it("capa tem ícone de traço (sem emoji) e nome; verso tem nome e descrição", () => {
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" role="gestor" />);
    expect(container.querySelectorAll(".v2-menu-capa .v2-menu-icone svg")).toHaveLength(7);
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(container.textContent).toContain("KPIs de campanhas, Meta Ads, Google Ads e leads orgânicos");
    expect(container.textContent).toContain("Ajustes do projeto e gerenciamento de dados");
  });

  it("Central de links é um cartão grande com link para a tela, sem selo de em breve", () => {
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" role="gestor" />);
    expect(container.querySelector(".v2-menu-card--em-breve")).toBeNull();
    expect(container.textContent).not.toContain("Em breve");
    const cartao = screen.getByRole("link", { name: /Central de links/ });
    expect(cartao.getAttribute("href")).toBe("/v2/central-de-links");
    expect(cartao.getAttribute("aria-disabled")).toBeNull();
    expect(cartao.className).not.toContain("v2-menu-card--pequeno");
  });

  it("Configurações usa o cartão menor, e os da faixa do layout anterior também", () => {
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" role="gestor" />);
    const pequenos = container.querySelectorAll(".v2-menu-card--pequeno");
    expect(pequenos).toHaveLength(3);
    expect(pequenos[0].getAttribute("href")).toBe("/v2/ajustes");
  });

  it("Sair é um botão que dá POST no signout e é o menor dos cartões", () => {
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" role="gestor" />);
    const form = container.querySelector('form[action="/api/auth/signout"]') as HTMLFormElement;
    expect(form.method).toBe("post");
    const botao = form.querySelector("button[type=submit]") as HTMLElement;
    expect(botao.className).toContain("v2-menu-card--mini");
    expect(botao.textContent).toContain("Sair");
    const css = readFileSync(join(__dirname, "../menu-principal/menu-principal.css"), "utf8");
    const largura = (classe: string) =>
      parseFloat(css.match(new RegExp(String.raw`${classe}\s*\{[^}]*--w:\s*([\d.]+)rem`))![1]);
    expect(largura("\.v2-menu-card--mini")).toBeLessThan(largura("\.v2-menu-card--pequeno"));
  });

  it("cada cartão leva a própria cor de destaque", () => {
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" role="gestor" />);
    const cores = Array.from(container.querySelectorAll<HTMLElement>(".v2-menu-card")).map((el) =>
      el.style.getPropertyValue("--destaque"),
    );
    expect(cores).toEqual(["#6ec3ea", "#8fb3a3", "#d9b26a", "#8fa6b5", "#a8939b", "#7fa6e8", "#7fbf9a"]);
  });
});

describe("cabeçalho do menu", () => {
  it("saúda pelo primeiro nome e mostra a logo do IGT", () => {
    render(<MenuPrincipal saudacao="Boa tarde" nome="Ana" role="gestor" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Boa tarde, Ana");
    expect(screen.getByAltText("IGT")).toBeTruthy();
  });

  it("sem nome, só a saudação", () => {
    render(<MenuPrincipal saudacao="Boa noite" nome="" role="gestor" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Boa noite");
  });
});

describe("saudacao", () => {
  // 15h UTC = 12h em Brasília; os instantes abaixo são escolhidos pela hora de Brasília (UTC-3).
  const em = (horaBrasilia: number) => new Date(Date.UTC(2026, 9, 25, horaBrasilia + 3));
  it("muda nas fronteiras do dia", () => {
    expect(saudacao(em(4))).toBe("Boa noite");
    expect(saudacao(em(5))).toBe("Bom dia");
    expect(saudacao(em(11))).toBe("Bom dia");
    expect(saudacao(em(12))).toBe("Boa tarde");
    expect(saudacao(em(17))).toBe("Boa tarde");
    expect(saudacao(em(18))).toBe("Boa noite");
    expect(saudacao(em(0))).toBe("Boa noite");
  });
  it("primeiroNome usa o cadastro e cai no e-mail", () => {
    expect(primeiroNome({ user_metadata: { name: "  Ana Paula Souza " } })).toBe("Ana");
    expect(primeiroNome({ email: "joao@igt.com", user_metadata: {} })).toBe("joao");
    expect(primeiroNome(null)).toBe("");
  });
});
