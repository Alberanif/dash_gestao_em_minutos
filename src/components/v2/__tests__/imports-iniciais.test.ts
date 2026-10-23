import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guarda do orçamento de JS inicial (180 KB gzip): o que o layout, o shell e as telas de produto
// importam estaticamente entra no bundle de toda rota /v2. Motion e o barrel de `ui` pesam muito.
const raiz = join(__dirname, "../../../..");
const lerFonte = (rel: string) => readFileSync(join(raiz, rel), "utf8");

const caminhoInicial = [
  "src/app/v2/layout.tsx",
  "src/components/v2/shell/v2-shell.tsx",
  "src/components/v2/shell/page-transition.tsx",
  "src/components/v2/eventos/estados.tsx",
  "src/components/v2/eventos/eventos-lista.tsx",
  "src/components/v2/eventos/metricas-celulas.tsx",
  "src/app/v2/indicadores/eventos/error.tsx",
];

describe("imports do caminho inicial das rotas /v2", () => {
  it.each(caminhoInicial)("%s não importa o Motion estaticamente", (rel) => {
    expect(lerFonte(rel)).not.toMatch(/from\s+["']motion\/react["']/);
  });

  it.each(caminhoInicial)("%s não importa os barrels de ui nem de motion", (rel) => {
    expect(lerFonte(rel)).not.toMatch(/from\s+["'](\.\.\/ui|@\/components\/v2\/ui|\.\.\/motion|@\/components\/v2\/motion)["']/);
  });

  it("CountUp carrega o `animate` do Motion sob demanda", () => {
    const src = lerFonte("src/components/v2/motion/count-up.tsx");
    expect(src).not.toMatch(/from\s+["']motion\/react["']/);
    expect(src).toMatch(/import\(["']motion\/react["']\)/);
  });
});
