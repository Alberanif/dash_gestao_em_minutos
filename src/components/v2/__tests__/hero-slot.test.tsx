/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import type { FilterRecord } from "@/types/indicadores";
import { ProvedorEvento } from "../evento/contexto";
import { HeroSlot } from "../evento/hero-slot";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const FILTRO = { id: "1", name: "Protocolo 6% - Outubro", status: "ativo" } as FilterRecord;
const PERIODO = { startDate: "2026-09-26", endDate: "2026-10-24", preset: null };

function montar(status: FilterRecord["status"], filtro: FilterRecord = FILTRO, hoje = "2026-10-24") {
  return render(
    <ProvedorEvento filter={filtro} filters={[filtro]} periodoInicial={PERIODO} hoje={hoje}>
      <HeroSlot nome={filtro.name} status={status}>
        <div>controles</div>
      </HeroSlot>
    </ProvedorEvento>,
  );
}

describe("HeroSlot", () => {
  it("o título é lido uma vez só: a cópia que some ao carregar é escondida da leitura de tela", () => {
    const { container } = montar("ativo");
    expect(screen.getAllByText("Protocolo 6% - Outubro")).toHaveLength(2);
    expect(container.querySelector(".v2-titulo-forte")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".v2-titulo-base")?.getAttribute("aria-hidden")).toBeNull();
  });

  it("mostra o contador como espaço reservado e a duração do período, sem o antigo selo nem as datas", () => {
    const { container } = montar("ativo");
    expect(container.querySelector("[data-contagem]")?.textContent).toBe("-- dias para o evento");
    expect(screen.getByText("29 dias de evento")).toBeTruthy();
    expect(screen.queryByText("Ativo")).toBeNull();
    expect(screen.queryByText(/set a/)).toBeNull();
  });

  it("o ponto latão pulsa só com o evento ativo", () => {
    expect(montar("ativo").container.querySelector(".v2-hero-pulso")).not.toBeNull();
    expect(montar("finalizado").container.querySelector(".v2-hero-pulso")).toBeNull();
  });

  describe("contagem regressiva do evento configurado", () => {
    const evento = { ...FILTRO, start_date: "2026-11-01", end_date: "2026-11-10" } as FilterRecord;
    const contagem = (c: HTMLElement) => c.querySelector("[data-contagem]")?.textContent;

    it("conta os dias até o início e usa a duração do evento, não a do filtro de datas", () => {
      const { container } = montar("ativo", evento);
      expect(contagem(container)).toBe("8 dias para o evento");
      expect(screen.getByText("10 dias de evento")).toBeTruthy();
    });

    it("no dia anterior usa o singular, no dia do início e depois dele mostra que está em andamento", () => {
      expect(contagem(montar("ativo", evento, "2026-10-31").container)).toBe("1 dia para o evento");
      expect(contagem(montar("ativo", evento, "2026-11-01").container)).toBe("Em andamento");
      expect(contagem(montar("ativo", evento, "2026-11-05").container)).toBe("Em andamento");
    });

    it("depois do fim o evento está encerrado", () => {
      expect(contagem(montar("finalizado", evento, "2026-11-11").container)).toBe("Evento encerrado");
    });
  });
});
