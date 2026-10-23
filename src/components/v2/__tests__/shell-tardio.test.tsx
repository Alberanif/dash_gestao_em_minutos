/** @jest-environment jsdom */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MaisMenu } from "../shell/mais-menu";
import { TooltipTardio } from "../shell/tooltip-tardio";

const raiz = join(__dirname, "../../../..");

describe("MaisMenu", () => {
  function montar() {
    return render(
      <div>
        <MaisMenu botao={<span>Mais</span>}>
          <button type="button">Sair</button>
        </MaisMenu>
        <button type="button">fora</button>
      </div>,
    );
  }

  it("abre e fecha pelo botão, com aria-expanded", () => {
    montar();
    const botao = screen.getByRole("button", { name: "Mais" });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
    fireEvent.click(botao);
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy();
    fireEvent.click(botao);
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
  });

  it("Escape fecha e devolve o foco ao botão", () => {
    montar();
    const botao = screen.getByRole("button", { name: "Mais" });
    fireEvent.click(botao);
    const sair = screen.getByRole("button", { name: "Sair" });
    sair.focus();
    fireEvent.keyDown(sair, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
    expect(document.activeElement).toBe(botao);
  });

  it("clique fora fecha; clique dentro não", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Mais" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Sair" }));
    expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole("button", { name: "fora" }));
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
  });

  it("o foco saindo do menu fecha", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Mais" }));
    const sair = screen.getByRole("button", { name: "Sair" });
    sair.focus();
    fireEvent.blur(sair, { relatedTarget: screen.getByRole("button", { name: "fora" }) });
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
  });
});

/** O jsdom não tem PointerEvent: o `pointerType` precisa ser posto no evento à mão. */
function entrar(el: Element, pointerType: "mouse" | "touch") {
  const ev = createEvent.pointerOver(el);
  Object.defineProperty(ev, "pointerType", { value: pointerType });
  fireEvent(el, ev);
}

describe("TooltipTardio", () => {
  const filho = <a href="/x">Item</a>;

  it("renderiza o filho puro até o primeiro hover de mouse", () => {
    render(<TooltipTardio conteudo="Dica">{filho}</TooltipTardio>);
    const link = screen.getByRole("link", { name: "Item" });
    entrar(link, "touch");
    expect(screen.getByRole("link", { name: "Item" })).toBe(link);
  });

  it("hover de mouse troca para o Tooltip completo, sem perder o filho", async () => {
    render(<TooltipTardio conteudo="Dica">{filho}</TooltipTardio>);
    const link = screen.getByRole("link", { name: "Item" });
    await act(async () => {
      entrar(link, "mouse");
    });
    // O Tooltip completo remonta o filho: o elemento é outro, mas continua no lugar.
    await waitFor(() => expect(screen.getByRole("link", { name: "Item" })).not.toBe(link));
  });

  it("com o foco no próprio elemento, o hover não o remonta", async () => {
    render(<TooltipTardio conteudo="Dica">{filho}</TooltipTardio>);
    const link = screen.getByRole("link", { name: "Item" });
    link.focus();
    await act(async () => {
      entrar(link, "mouse");
    });
    expect(screen.getByRole("link", { name: "Item" })).toBe(link);
    expect(document.activeElement).toBe(link);
  });
});

describe("guarda de orçamento do shell", () => {
  it("o shell não importa Popover nem Tooltip do Radix estaticamente", () => {
    const src = readFileSync(join(raiz, "src/components/v2/shell/v2-shell.tsx"), "utf8");
    expect(src).not.toMatch(/from\s+["']\.\.\/ui\/(popover|tooltip)["']/);
    const tardio = readFileSync(join(raiz, "src/components/v2/shell/tooltip-tardio.tsx"), "utf8");
    expect(tardio).not.toMatch(/^import .*ui\/tooltip/m);
    expect(tardio).toMatch(/dynamic\(\(\) => import\(["']\.\.\/ui\/tooltip["']\)/);
  });

  it("os gráficos do dashboard do evento entram só por import dinâmico", () => {
    const blocos = ["bloco-plataformas", "bloco-leads", "bloco-jornada"].map((n) =>
      readFileSync(join(raiz, `src/components/v2/evento/${n}.tsx`), "utf8"),
    );
    for (const src of blocos) expect(src).not.toMatch(/from\s+["']\.\.\/charts\//);
    const lazy = readFileSync(join(raiz, "src/components/v2/evento/charts-lazy.tsx"), "utf8");
    expect((lazy.match(/dynamic\(/g) ?? []).length).toBe(3);
  });
});
