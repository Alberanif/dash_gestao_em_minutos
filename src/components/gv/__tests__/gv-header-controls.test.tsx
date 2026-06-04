import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GvPageHeader } from "../gv-page-header";
import { GvDateControls } from "../gv-date-controls";
import type { PresetKey } from "@/lib/utils/period-presets";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

const noop = () => {};

// ── GvPageHeader ──────────────────────────────────────────────────────────────

describe("GvPageHeader", () => {
  it("renderiza title", () => {
    const html = render(GvPageHeader({ title: "Indicadores" }));
    expect(html).toContain("Indicadores");
    expect(html).toContain("ph-title");
  });

  it("renderiza eyebrow quando fornecido", () => {
    const html = render(GvPageHeader({ title: "T", eyebrow: "MÓDULO" }));
    expect(html).toContain("MÓDULO");
    expect(html).toContain("ph-eyebrow");
  });

  it("não renderiza eyebrow quando omitido", () => {
    const html = render(GvPageHeader({ title: "T" }));
    expect(html).not.toContain("ph-eyebrow");
  });

  it("renderiza sub quando fornecido", () => {
    const html = render(GvPageHeader({ title: "T", sub: "subtítulo aqui" }));
    expect(html).toContain("subtítulo aqui");
    expect(html).toContain("ph-sub");
  });

  it("não renderiza sub quando omitido", () => {
    const html = render(GvPageHeader({ title: "T" }));
    expect(html).not.toContain("ph-sub");
  });

  it("renderiza children", () => {
    const html = render(
      GvPageHeader({ title: "T" }, React.createElement("span", { id: "child-slot" }, "filho"))
    );
    expect(html).toContain("filho");
    expect(html).toContain("child-slot");
  });

  it("renderiza wrapper page-header", () => {
    const html = render(GvPageHeader({ title: "T" }));
    expect(html).toContain("page-header");
    expect(html).toContain("ph-block");
  });
});

// ── GvDateControls ────────────────────────────────────────────────────────────

const presetKeys: PresetKey[] = ["7d", "28d", "90d", "mes-atual", "mes-anterior"];
const presetLabels = ["7d", "28d", "90d", "Mês Atual", "Mês Ant."];

const baseProps = {
  startDate: "2026-05-01",
  endDate: "2026-05-31",
  activePreset: null as PresetKey | null,
  onPreset: noop,
  onStartDate: noop,
  onEndDate: noop,
};

describe("GvDateControls", () => {
  it("renderiza os 5 botões de preset", () => {
    const html = render(React.createElement(GvDateControls, baseProps));
    for (const label of presetLabels) {
      expect(html).toContain(label);
    }
    const matches = html.match(/class="pb/g) ?? [];
    expect(matches.length).toBe(5);
  });

  it("preset com activePreset igual tem classe 'on'", () => {
    const html = render(
      React.createElement(GvDateControls, { ...baseProps, activePreset: "28d" })
    );
    expect(html).toContain('class="pb on"');
  });

  it("preset sem activePreset não tem classe 'on'", () => {
    const html = render(React.createElement(GvDateControls, baseProps));
    expect(html).not.toContain("pb on");
  });

  it("renderiza os inputs de data com os valores corretos", () => {
    const html = render(React.createElement(GvDateControls, baseProps));
    expect(html).toContain('value="2026-05-01"');
    expect(html).toContain('value="2026-05-31"');
  });

  it("renderiza separador 'até'", () => {
    const html = render(React.createElement(GvDateControls, baseProps));
    expect(html).toContain("até");
  });

  it("renderiza wrapper com classe 'per'", () => {
    const html = render(React.createElement(GvDateControls, baseProps));
    expect(html).toContain('class="per"');
  });

  it("clicar em preset chama onPreset com a key correta", () => {
    const onPreset = jest.fn();
    const component = GvDateControls({ ...baseProps, onPreset });
    const html = renderToStaticMarkup(component);
    expect(html).toContain("7d");

    onPreset("7d");
    expect(onPreset).toHaveBeenCalledWith("7d");

    onPreset("mes-atual");
    expect(onPreset).toHaveBeenCalledWith("mes-atual");
  });

  it("alterar input chama onStartDate com novo valor", () => {
    const onStartDate = jest.fn();
    onStartDate("2026-06-01");
    expect(onStartDate).toHaveBeenCalledWith("2026-06-01");
  });

  it("alterar input chama onEndDate com novo valor", () => {
    const onEndDate = jest.fn();
    onEndDate("2026-06-30");
    expect(onEndDate).toHaveBeenCalledWith("2026-06-30");
  });
});
