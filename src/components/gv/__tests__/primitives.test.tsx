import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { StatusChip } from "@/components/gv/status-chip";
import { DeltaBadge } from "@/components/gv/delta-badge";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

// ── StatusChip ────────────────────────────────────────────────────────────────

describe("StatusChip", () => {
  it("green: html contém class chip green", () => {
    const html = render(<StatusChip status="green" />);
    expect(html).toContain("chip green");
  });

  it("amber: html contém class chip amber", () => {
    const html = render(<StatusChip status="amber" />);
    expect(html).toContain("chip amber");
  });

  it("red: html contém class chip red", () => {
    const html = render(<StatusChip status="red" />);
    expect(html).toContain("chip red");
  });

  it("red: html contém dot (animado via CSS pDot)", () => {
    const html = render(<StatusChip status="red" />);
    expect(html).toContain("dot");
  });

  it("com label: html contém o label", () => {
    const html = render(<StatusChip status="green" label="Ativo" />);
    expect(html).toContain("Ativo");
  });
});

// ── DeltaBadge ────────────────────────────────────────────────────────────────

describe("DeltaBadge", () => {
  it("positivo: contém dbadge up e valor positivo", () => {
    const html = render(<DeltaBadge value={12.5} />);
    expect(html).toContain("dbadge up");
    expect(html).toContain("12.5");
  });

  it("negativo: contém dbadge down e valor negativo (absoluto)", () => {
    const html = render(<DeltaBadge value={-8.3} />);
    expect(html).toContain("dbadge down");
    expect(html).toContain("8.3");
  });

  it("zero: contém dbadge flat e sem seta", () => {
    const html = render(<DeltaBadge value={0} />);
    expect(html).toContain("dbadge flat");
    expect(html).not.toContain("polyline");
    expect(html).toContain("—");
  });

  it("positivo: contém seta para cima (polyline up)", () => {
    const html = render(<DeltaBadge value={5} />);
    expect(html).toContain("polyline");
    expect(html).toContain("18 15 12 9 6 15");
  });

  it("negativo: contém seta para baixo (polyline down)", () => {
    const html = render(<DeltaBadge value={-3} />);
    expect(html).toContain("polyline");
    expect(html).toContain("6 9 12 15 18 9");
  });

  it("unit padrão é %", () => {
    const html = render(<DeltaBadge value={10} />);
    expect(html).toContain("%");
  });

  it("unit customizado é respeitado", () => {
    const html = render(<DeltaBadge value={10} unit="x" />);
    expect(html).toContain("x");
  });
});
