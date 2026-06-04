import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountTabs } from "../account-tabs";
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

describe("AccountTabs", () => {
  it("renderiza nada quando lista de contas está vazia", () => {
    const html = renderToStaticMarkup(
      React.createElement(AccountTabs, {
        accounts: [],
        selectedId: "",
        onSelect: () => {},
      })
    );
    expect(html).toBe("");
  });

  it("renderiza botões para cada conta quando há múltiplas contas", () => {
    const accounts = [makeAccount("a1", "Conta Principal"), makeAccount("a2", "Conta Secundária")];
    const html = renderToStaticMarkup(
      React.createElement(AccountTabs, {
        accounts,
        selectedId: "a1",
        onSelect: () => {},
      })
    );
    expect(html).toContain("Conta Principal");
    expect(html).toContain("Conta Secundária");
  });

  it("usa classe pset no container e pb nos botões (design GV)", () => {
    const accounts = [makeAccount("a1", "Conta A"), makeAccount("a2", "Conta B")];
    const html = renderToStaticMarkup(
      React.createElement(AccountTabs, {
        accounts,
        selectedId: "a1",
        onSelect: () => {},
      })
    );
    expect(html).toContain("pset");
    expect(html).toContain("pb on");
    expect(html).toContain("pb ");
  });

  it("com conta única: botão tem title 'Única conta cadastrada'", () => {
    const accounts = [makeAccount("a1", "Conta Principal")];
    const html = renderToStaticMarkup(
      React.createElement(AccountTabs, {
        accounts,
        selectedId: "a1",
        onSelect: () => {},
      })
    );
    expect(html).toContain('title="Única conta cadastrada"');
  });

  it("com conta única: botão tem cursor-default (não clicável)", () => {
    const accounts = [makeAccount("a1", "Conta Principal")];
    const html = renderToStaticMarkup(
      React.createElement(AccountTabs, {
        accounts,
        selectedId: "a1",
        onSelect: () => {},
      })
    );
    expect(html).toContain("cursor-default");
  });

  it("com conta única: botão tem opacidade reduzida", () => {
    const accounts = [makeAccount("a1", "Conta Principal")];
    const html = renderToStaticMarkup(
      React.createElement(AccountTabs, {
        accounts,
        selectedId: "a1",
        onSelect: () => {},
      })
    );
    expect(html).toContain("opacity-60");
  });

  it("com múltiplas contas: botões não têm cursor-default nem title de conta única", () => {
    const accounts = [makeAccount("a1", "Conta A"), makeAccount("a2", "Conta B")];
    const html = renderToStaticMarkup(
      React.createElement(AccountTabs, {
        accounts,
        selectedId: "a1",
        onSelect: () => {},
      })
    );
    expect(html).not.toContain("cursor-default");
    expect(html).not.toContain("Única conta cadastrada");
  });
});
