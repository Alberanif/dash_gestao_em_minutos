/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Tooltip,
} from "../ui";

beforeAll(() => {
  // Radix Popper mede o gatilho com ResizeObserver, que o jsdom não tem.
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("Button", () => {
  it("é um <button type=button> e respeita disabled", () => {
    render(<Button disabled>Salvar</Button>);
    const b = screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(b.type).toBe("button");
    expect(b.disabled).toBe(true);
  });

  it("tem anel de foco visível por teclado", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button").className).toContain("focus-visible:outline-2");
  });

  it("nunca usa o âmbar (ponto) como cor", () => {
    render(
      <>
        <Button variante="primario">a</Button>
        <Button variante="secundario">b</Button>
        <Button variante="fantasma">c</Button>
      </>,
    );
    for (const b of screen.getAllByRole("button")) expect(b.className).not.toContain("ponto");
  });
});

describe("Tabs", () => {
  function Exemplo() {
    return (
      <Tabs defaultValue="a">
        <TabsList aria-label="Abas">
          <TabsTrigger value="a">Geral</TabsTrigger>
          <TabsTrigger value="b">Campanhas</TabsTrigger>
        </TabsList>
        <TabsContent value="a">conteúdo a</TabsContent>
        <TabsContent value="b">conteúdo b</TabsContent>
      </Tabs>
    );
  }

  it("preserva os papéis ARIA do Radix", () => {
    render(<Exemplo />);
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Geral" }).getAttribute("aria-selected")).toBe("true");
  });

  it("troca de aba com a seta do teclado", async () => {
    render(<Exemplo />);
    const a = screen.getByRole("tab", { name: "Geral" });
    act(() => a.focus());
    fireEvent.keyDown(a, { key: "ArrowRight" });
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Campanhas" }).getAttribute("aria-selected")).toBe("true"),
    );
  });
});

describe("Dialog", () => {
  it("abre com role=dialog e fecha com Esc", () => {
    render(
      <Dialog>
        <DialogTrigger>Abrir</DialogTrigger>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
          <DialogDescription>Descrição</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("Abrir"));
    const dlg = screen.getByRole("dialog");
    expect(dlg.getAttribute("aria-labelledby")).toBeTruthy();
    fireEvent.keyDown(dlg, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Select", () => {
  const opcoes = [
    { value: "7", label: "7 dias" },
    { value: "30", label: "30 dias" },
  ];

  it("expõe um combobox com nome acessível", () => {
    render(<Select aria-label="Período" value="7" opcoes={opcoes} />);
    const cb = screen.getByRole("combobox", { name: "Período" });
    expect(cb.getAttribute("aria-expanded")).toBe("false");
  });

  it("desabilitado não é operável", () => {
    render(<Select aria-label="Período" value="7" opcoes={opcoes} disabled />);
    expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Tooltip", () => {
  it("abre no foco do teclado com role=tooltip", async () => {
    render(
      <Tooltip conteudo="Dica">
        <button>Alvo</button>
      </Tooltip>,
    );
    act(() => screen.getByText("Alvo").focus());
    expect((await screen.findAllByRole("tooltip")).length).toBeGreaterThan(0);
  });
});
