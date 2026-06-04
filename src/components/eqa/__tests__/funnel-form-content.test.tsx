import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FunnelFormContent } from "../funnel-form-content";
import type { LancamentoPagoFunnel, LancamentoFunnel } from "@/types/funnels";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

const mockPago: LancamentoPagoFunnel = {
  id: "f1",
  name: "Destrave Abril 2026",
  type: "lancamento_pago",
  start_date: "2026-04-01",
  end_date: "2026-04-30",
  goal_sales: 120,
  config: { product_ids: ["p1"], ad_account_ids: ["a1"], campaign_ids: [], inactive_ads: false },
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

const mockLancamento: LancamentoFunnel = {
  id: "f2",
  name: "Captação Maio",
  type: "lancamento",
  start_date: "2026-05-01",
  end_date: "2026-05-31",
  goal_sales: 50,
  config: { ad_account_ids: ["a1"], campaign_ids: [] },
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

const noop = async () => {};

describe("FunnelFormContent", () => {
  // Ciclo 1 — tracer bullet
  it("pré-preenche o nome do funil ao editar", () => {
    const html = render(
      <FunnelFormContent funnel={mockPago} onSave={noop} onCancel={() => {}} />
    );
    expect(html).toContain("Destrave Abril 2026");
  });

  // Ciclo 2
  it("nome vazio ao criar novo funil", () => {
    const html = render(
      <FunnelFormContent onSave={noop} onCancel={() => {}} />
    );
    expect(html).not.toContain("Destrave Abril 2026");
  });

  // Ciclo 3
  it("exibe seção Produtos Hotmart para lancamento_pago", () => {
    const html = render(
      <FunnelFormContent funnel={mockPago} onSave={noop} onCancel={() => {}} />
    );
    expect(html).toContain("Produtos Hotmart");
  });

  // Ciclo 4
  it("oculta seção Produtos Hotmart para lancamento", () => {
    const html = render(
      <FunnelFormContent funnel={mockLancamento} onSave={noop} onCancel={() => {}} />
    );
    expect(html).not.toContain("Produtos Hotmart");
  });
});
