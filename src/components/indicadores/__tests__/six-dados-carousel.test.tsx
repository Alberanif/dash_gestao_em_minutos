/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { SixDadosCarousel, type SixDadosCardData } from "../six-dados-carousel";
import type { AiReportKpiSnapshot } from "@/types/indicadores";

function kpiBlock(overrides: Partial<AiReportKpiSnapshot["lifetime"]> = {}) {
  return {
    roas: 3.2,
    revenueBrl: 48200,
    leads: 1840,
    cpl: 9,
    spend: 15000,
    sales: 120,
    startDate: "2026-01-01",
    endDate: "2026-07-16",
    ...overrides,
  };
}

function snapshot(overrides: Partial<AiReportKpiSnapshot["lifetime"]> = {}): AiReportKpiSnapshot {
  return {
    lifetime: kpiBlock(overrides),
    last7d: kpiBlock(overrides),
  };
}

function item(overrides: Partial<SixDadosCardData> = {}): SixDadosCardData {
  return {
    filterId: "f1",
    name: "Evento 1",
    reportText: "Texto executivo com narrativa curta sobre o evento.",
    kpiSnapshot: snapshot(),
    generatedAt: "2026-07-16T10:00:00.000Z",
    status: "ready",
    ...overrides,
  };
}

describe("SixDadosCarousel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-16T10:40:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("estados de contagem de itens", () => {
    it("0 itens: não renderiza nada", () => {
      const { container } = render(<SixDadosCarousel items={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("1 item: card fixo, sem dots nem setas", () => {
      render(<SixDadosCarousel items={[item({ filterId: "f1", name: "Evento Único" })]} />);
      expect(screen.getByText("Evento Único")).toBeTruthy();
      expect(screen.queryByTestId("six-dados-prev")).toBeNull();
      expect(screen.queryByTestId("six-dados-next")).toBeNull();
      expect(screen.queryByTestId("six-dados-dot-0")).toBeNull();
    });

    it("3 itens: dots e setas presentes", () => {
      render(
        <SixDadosCarousel
          items={[
            item({ filterId: "f1", name: "Evento 1" }),
            item({ filterId: "f2", name: "Evento 2" }),
            item({ filterId: "f3", name: "Evento 3" }),
          ]}
        />
      );
      expect(screen.getByTestId("six-dados-prev")).toBeTruthy();
      expect(screen.getByTestId("six-dados-next")).toBeTruthy();
      expect(screen.getByTestId("six-dados-dot-0")).toBeTruthy();
      expect(screen.getByTestId("six-dados-dot-1")).toBeTruthy();
      expect(screen.getByTestId("six-dados-dot-2")).toBeTruthy();
    });

    it("dots ficam dentro do cabeçalho do card, ao lado do nome do Evento", () => {
      render(
        <SixDadosCarousel
          items={[
            item({ filterId: "f1", name: "Evento 1" }),
            item({ filterId: "f2", name: "Evento 2" }),
            item({ filterId: "f3", name: "Evento 3" }),
          ]}
        />
      );
      const card = screen.getByTestId("six-dados-card-f1");
      const cardScope = within(card);
      expect(cardScope.getByTestId("six-dados-dot-0")).toBeTruthy();
      expect(cardScope.getByTestId("six-dados-dot-1")).toBeTruthy();
      expect(cardScope.getByTestId("six-dados-dot-2")).toBeTruthy();
    });
  });

  describe("rotação automática", () => {
    it("avança automaticamente a cada 30s e volta ao primeiro no loop", () => {
      render(
        <SixDadosCarousel
          items={[
            item({ filterId: "f1", name: "Evento 1" }),
            item({ filterId: "f2", name: "Evento 2" }),
            item({ filterId: "f3", name: "Evento 3" }),
          ]}
        />
      );
      expect(screen.getByText("Evento 1")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      expect(screen.getByText("Evento 2")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      expect(screen.getByText("Evento 3")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      expect(screen.getByText("Evento 1")).toBeTruthy();
    });

    it("avança no próximo tick mesmo quando a lista encolhe deixando o índice ativo além do fim", () => {
      const { rerender } = render(
        <SixDadosCarousel
          items={[
            item({ filterId: "f1", name: "Evento 1" }),
            item({ filterId: "f2", name: "Evento 2" }),
            item({ filterId: "f3", name: "Evento 3" }),
          ]}
        />
      );

      fireEvent.click(screen.getByTestId("six-dados-dot-2"));
      expect(screen.getByText("Evento 3")).toBeTruthy();

      // Evento 3 sai da lista de ativos; o índice ativo (2) fica além do novo fim (1).
      rerender(
        <SixDadosCarousel
          items={[item({ filterId: "f1", name: "Evento 1" }), item({ filterId: "f2", name: "Evento 2" })]}
        />
      );
      expect(screen.getByText("Evento 2")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      // Sem o clamp no tick, (2 + 1) % 2 === 1 volta a cair no mesmo card (ciclo travado).
      expect(screen.getByText("Evento 1")).toBeTruthy();
    });
  });

  describe("navegação manual", () => {
    it("clique na seta próxima muda o card e reinicia o timer", () => {
      render(
        <SixDadosCarousel
          items={[
            item({ filterId: "f1", name: "Evento 1" }),
            item({ filterId: "f2", name: "Evento 2" }),
            item({ filterId: "f3", name: "Evento 3" }),
          ]}
        />
      );

      act(() => {
        jest.advanceTimersByTime(20_000);
      });
      fireEvent.click(screen.getByTestId("six-dados-next"));
      expect(screen.getByText("Evento 2")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(29_000);
      });
      expect(screen.getByText("Evento 2")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(1_000);
      });
      expect(screen.getByText("Evento 3")).toBeTruthy();
    });

    it("clique em um dot muda para o card correspondente e reinicia o timer", () => {
      render(
        <SixDadosCarousel
          items={[
            item({ filterId: "f1", name: "Evento 1" }),
            item({ filterId: "f2", name: "Evento 2" }),
            item({ filterId: "f3", name: "Evento 3" }),
          ]}
        />
      );

      fireEvent.click(screen.getByTestId("six-dados-dot-2"));
      expect(screen.getByText("Evento 3")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(29_000);
      });
      expect(screen.getByText("Evento 3")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(1_000);
      });
      expect(screen.getByText("Evento 1")).toBeTruthy();
    });
  });

  describe("hover pausa a rotação", () => {
    it("hover pausa e mouse leave retoma", () => {
      const { getByTestId } = render(
        <SixDadosCarousel
          items={[
            item({ filterId: "f1", name: "Evento 1" }),
            item({ filterId: "f2", name: "Evento 2" }),
            item({ filterId: "f3", name: "Evento 3" }),
          ]}
        />
      );
      const carousel = getByTestId("six-dados-carousel");

      fireEvent.mouseEnter(carousel);
      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      expect(screen.getByText("Evento 1")).toBeTruthy();

      fireEvent.mouseLeave(carousel);
      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      expect(screen.getByText("Evento 2")).toBeTruthy();
    });
  });

  describe("estados do card", () => {
    it("renderiza KPIs formatados a partir do snapshot e a narrativa", () => {
      render(<SixDadosCarousel items={[item()]} />);
      expect(screen.getByText("3.2x")).toBeTruthy();
      expect(screen.getByText(/R\$\s?48\.200|R\$\s?48\.2/)).toBeTruthy();
      expect(screen.getByText("1.840")).toBeTruthy();
      expect(screen.getByText(/R\$\s?9/)).toBeTruthy();
      expect(screen.getByText("Texto executivo com narrativa curta sobre o evento.")).toBeTruthy();
    });

    it("usa travessão para KPIs indisponíveis (null), nunca 0", () => {
      render(
        <SixDadosCarousel
          items={[
            item({
              kpiSnapshot: {
                lifetime: kpiBlock({ roas: null, revenueBrl: null, leads: null, cpl: null }),
                last7d: kpiBlock(),
              },
            }),
          ]}
        />
      );
      expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
      expect(screen.queryByText("0")).toBeNull();
    });

    it("status generating sem snapshot mostra skeleton completo", () => {
      render(
        <SixDadosCarousel items={[item({ status: "generating", kpiSnapshot: null, reportText: null, generatedAt: null })]} />
      );
      expect(screen.getByTestId("six-dados-skeleton-f1")).toBeTruthy();
      expect(screen.queryByText("Texto executivo com narrativa curta sobre o evento.")).toBeNull();
    });

    it("status generating com snapshot mostra KPIs e narrativa em skeleton", () => {
      render(<SixDadosCarousel items={[item({ status: "generating", reportText: null })]} />);
      expect(screen.getByText("3.2x")).toBeTruthy();
      expect(screen.getByTestId("six-dados-narrative-skeleton-f1")).toBeTruthy();
    });

    it("status error sem reportText mostra 'resumo indisponível'", () => {
      render(<SixDadosCarousel items={[item({ status: "error", reportText: null, generatedAt: null })]} />);
      expect(screen.getByText(/resumo indisponível/i)).toBeTruthy();
    });

    it("status error com reportText antigo mostra o texto e um aviso discreto de desatualizado", () => {
      render(<SixDadosCarousel items={[item({ status: "error" })]} />);
      expect(screen.getByText("Texto executivo com narrativa curta sobre o evento.")).toBeTruthy();
      expect(screen.getByText(/desatualizado/i)).toBeTruthy();
    });

    it("mostra rodapé 'Atualizado há X min' calculado de generatedAt", () => {
      render(<SixDadosCarousel items={[item({ generatedAt: "2026-07-16T10:00:00.000Z" })]} />);
      expect(screen.getByText(/Atualizado há 40 min/)).toBeTruthy();
    });

    it("com 1 item (sem rotação), o rodapé 'Atualizado há X min' segue avançando com o tempo", () => {
      render(<SixDadosCarousel items={[item({ filterId: "f1", generatedAt: "2026-07-16T10:00:00.000Z" })]} />);
      expect(screen.getByText(/Atualizado há 40 min/)).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByText(/Atualizado há 41 min/)).toBeTruthy();
    });
  });

  describe("limpeza de timer", () => {
    it("limpa o setInterval no unmount", () => {
      const clearSpy = jest.spyOn(window, "clearInterval");
      const { unmount } = render(
        <SixDadosCarousel
          items={[item({ filterId: "f1" }), item({ filterId: "f2" })]}
        />
      );
      unmount();
      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });
});
