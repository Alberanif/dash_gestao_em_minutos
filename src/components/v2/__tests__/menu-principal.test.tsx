/** @jest-environment jsdom */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { CARTOES_DO_MENU, MenuPrincipal } from "../menu-principal/menu-principal";
import { primeiroNome, saudacao } from "../menu-principal/saudacao";

describe("menu principal da V2", () => {
  it("tem Indicadores, Central de links, Configurações e Sair, nessa ordem", () => {
    expect(CARTOES_DO_MENU.map((c) => c.titulo)).toEqual([
      "Indicadores",
      "Central de links",
      "Configurações",
      "Sair",
    ]);
  });

  it("Indicadores, Central de links e Configurações levam às suas telas da V2", () => {
    render(<MenuPrincipal saudacao="Bom dia" nome="Ana" />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/v2/indicadores",
      "/v2/central-de-links",
      "/v2/ajustes",
    ]);
  });

  it("capa tem ícone de traço (sem emoji) e nome; verso tem nome e descrição", () => {
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" />);
    expect(container.querySelectorAll(".v2-menu-capa .v2-menu-icone svg")).toHaveLength(4);
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(container.textContent).toContain("KPIs de campanhas, Meta Ads, Google Ads e leads orgânicos");
    expect(container.textContent).toContain("Ajustes do projeto e gerenciamento de dados");
  });

  it("Central de links é um cartão grande com link para a tela, sem selo de em breve", () => {
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" />);
    expect(container.querySelector(".v2-menu-card--em-breve")).toBeNull();
    expect(container.textContent).not.toContain("Em breve");
    const cartao = screen.getByRole("link", { name: /Central de links/ });
    expect(cartao.getAttribute("href")).toBe("/v2/central-de-links");
    expect(cartao.getAttribute("aria-disabled")).toBeNull();
    expect(cartao.className).not.toContain("v2-menu-card--pequeno");
  });

  it("só Configurações usa o cartão menor", () => {
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" />);
    const pequenos = container.querySelectorAll(".v2-menu-card--pequeno");
    expect(pequenos).toHaveLength(1);
    expect(pequenos[0].getAttribute("href")).toBe("/v2/ajustes");
  });

  it("Sair é um botão que dá POST no signout e é o menor dos cartões", () => {
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" />);
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
    const { container } = render(<MenuPrincipal saudacao="Bom dia" nome="Ana" />);
    const cores = Array.from(container.querySelectorAll<HTMLElement>(".v2-menu-card")).map((el) =>
      el.style.getPropertyValue("--destaque"),
    );
    expect(cores).toEqual(["#6ec3ea", "#8fb3a3", "#8fa6b5", "#a8939b"]);
  });
});

describe("cabeçalho do menu", () => {
  it("saúda pelo primeiro nome e mostra a logo do IGT", () => {
    render(<MenuPrincipal saudacao="Boa tarde" nome="Ana" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Boa tarde, Ana");
    expect(screen.getByAltText("IGT")).toBeTruthy();
  });

  it("sem nome, só a saudação", () => {
    render(<MenuPrincipal saudacao="Boa noite" nome="" />);
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
