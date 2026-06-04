import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountSectionHeader } from "../account-section-header";
import type { Account } from "@/types/accounts";

function makeAccount(id: string, name: string): Account {
  return {
    id,
    name,
    platform: "instagram",
    credentials: { access_token: "tok", user_id: "uid" },
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
  };
}

describe("AccountSectionHeader", () => {
  it("renderiza skeleton com animate-pulse quando accounts é null (carregando)", () => {
    const html = renderToStaticMarkup(
      React.createElement(AccountSectionHeader, {
        title: "Instagram",
        accounts: null,
        selectedId: "",
        onSelect: () => {},
      })
    );
    expect(html).toContain("animate-pulse");
    expect(html).toContain("Instagram");
  });

  it("renderiza somente o título quando accounts é array vazio", () => {
    const html = renderToStaticMarkup(
      React.createElement(AccountSectionHeader, {
        title: "Instagram",
        accounts: [],
        selectedId: "",
        onSelect: () => {},
      })
    );
    expect(html).toContain("Instagram");
    expect(html).not.toContain("animate-pulse");
    expect(html).not.toContain("button");
  });

  it("renderiza AccountTabs quando há contas disponíveis", () => {
    const accounts = [makeAccount("a1", "Conta A"), makeAccount("a2", "Conta B")];
    const html = renderToStaticMarkup(
      React.createElement(AccountSectionHeader, {
        title: "Instagram",
        accounts,
        selectedId: "a1",
        onSelect: () => {},
      })
    );
    expect(html).toContain("Instagram");
    expect(html).toContain("Conta A");
    expect(html).toContain("Conta B");
    expect(html).not.toContain("animate-pulse");
  });

  it("passa selectedId para AccountTabs — conta selecionada recebe classe 'pb on'", () => {
    const accounts = [makeAccount("a1", "Conta A"), makeAccount("a2", "Conta B")];
    const html = renderToStaticMarkup(
      React.createElement(AccountSectionHeader, {
        title: "Instagram",
        accounts,
        selectedId: "a2",
        onSelect: () => {},
      })
    );
    expect(html).toContain("Conta B");
    expect(html).toContain("pb on");
  });
});
