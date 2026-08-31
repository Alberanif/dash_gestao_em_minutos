import { groupCyclesByFolder } from "../group-cycles";
import type { VendasFolderRecord } from "@/types/vendas";
import type { CycleWithProducts } from "@/components/vendas/types";

function mockCycle(id: string, name: string, folderId: string | null = null, createdAt: string = "2026-08-01T10:00:00Z"): CycleWithProducts {
  return {
    id,
    name,
    account_id: "acc-1",
    goal_percent: 80,
    status: "ativo",
    counts_new_buyers: true,
    purchases_only: false,
    folder_id: folderId,
    refresh_started_at: null,
    last_refresh_at: null,
    created_by: "user-1",
    created_at: createdAt,
    updated_at: createdAt,
    products: [],
  };
}

function mockFolder(id: string, name: string): VendasFolderRecord {
  return {
    id,
    account_id: "acc-1",
    name,
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
  };
}

describe("groupCyclesByFolder", () => {
  it("coloca ciclos sem folder_id em 'Sem pasta'", () => {
    const c1 = mockCycle("c1", "Ciclo 1");
    const groups = groupCyclesByFolder([c1], []);

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("unfoldered");
    expect(groups[0].name).toBe("Sem pasta");
    expect(groups[0].cycles).toHaveLength(1);
    expect(groups[0].isExpanded).toBe(true);
  });

  it("ordena pastas alfabeticamente (A-Z) com 'Sem pasta' por último", () => {
    const f1 = mockFolder("f1", "Zeta");
    const f2 = mockFolder("f2", "Alfa");
    const c1 = mockCycle("c1", "Ciclo Alfa", "f2");
    const c2 = mockCycle("c2", "Ciclo Sem Pasta", null);

    const groups = groupCyclesByFolder([c1, c2], [f1, f2]);

    expect(groups.map((g) => g.name)).toEqual(["Alfa", "Zeta", "Sem pasta"]);
    expect(groups[0].cycles).toHaveLength(1);
    expect(groups[1].cycles).toHaveLength(0);
    expect(groups[2].cycles).toHaveLength(1);
  });

  it("ordena ciclos por created_at desc dentro de cada grupo", () => {
    const f1 = mockFolder("f1", "Pasta 1");
    const c1 = mockCycle("c1", "Antigo", "f1", "2026-01-01T10:00:00Z");
    const c2 = mockCycle("c2", "Recente", "f1", "2026-08-01T10:00:00Z");

    const groups = groupCyclesByFolder([c1, c2], [f1]);

    expect(groups[0].cycles[0].id).toBe("c2");
    expect(groups[0].cycles[1].id).toBe("c1");
  });

  it("expande apenas o grupo que contém o ciclo selecionado", () => {
    const f1 = mockFolder("f1", "Pasta Alfa");
    const f2 = mockFolder("f2", "Pasta Beta");
    const c1 = mockCycle("c1", "Ciclo 1", "f1");
    const c2 = mockCycle("c2", "Ciclo 2", "f2");

    const groups = groupCyclesByFolder([c1, c2], [f1, f2], "c2");

    const alfaGroup = groups.find((g) => g.id === "f1");
    const betaGroup = groups.find((g) => g.id === "f2");

    expect(alfaGroup?.isExpanded).toBe(false);
    expect(betaGroup?.isExpanded).toBe(true);
  });

  it("com lista de pastas e ciclos vazia", () => {
    const groups = groupCyclesByFolder([], []);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Sem pasta");
    expect(groups[0].cycles).toHaveLength(0);
    expect(groups[0].isExpanded).toBe(true);
  });
});
