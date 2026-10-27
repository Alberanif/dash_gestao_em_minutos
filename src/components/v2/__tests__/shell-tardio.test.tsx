/** @jest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = join(__dirname, "../../../..");

describe("guarda de orçamento do shell", () => {
  it("o shell não importa Popover nem Tooltip do Radix estaticamente", () => {
    const src = readFileSync(join(raiz, "src/components/v2/shell/v2-shell.tsx"), "utf8");
    expect(src).not.toMatch(/from\s+["']\.\.\/ui\/(popover|tooltip)["']/);
  });

  it("os gráficos do dashboard do evento entram só por import dinâmico", () => {
    const blocos = ["bloco-plataformas", "bloco-leads", "bloco-jornada"].map((n) =>
      readFileSync(join(raiz, `src/components/v2/evento/${n}.tsx`), "utf8"),
    );
    for (const src of blocos) expect(src).not.toMatch(/from\s+["']\.\.\/charts\//);
    const lazy = readFileSync(join(raiz, "src/components/v2/evento/charts-lazy.tsx"), "utf8");
    expect((lazy.match(/dynamic\(/g) ?? []).length).toBe(5);
  });
});
