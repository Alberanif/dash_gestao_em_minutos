import fs from "fs";
import path from "path";

/**
 * Critério da #252: nenhuma animação usa propriedade além de transform e opacity.
 * Varre o código-fonte do V2 em busca de transições e keyframes com outras propriedades.
 */
const RAIZ = path.resolve(__dirname, "..");

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : arquivos(p);
    return /\.(tsx?|css)$/.test(e.name) ? [p] : [];
  });
}

const PERMITIDAS = new Set(["transition-transform", "transition-opacity"]);

describe("animações só com transform e opacity", () => {
  const todos = arquivos(RAIZ);

  it("encontra os arquivos do V2", () => {
    expect(todos.length).toBeGreaterThan(5);
  });

  it("classes transition-* do Tailwind são só transform ou opacity", () => {
    const ruins: string[] = [];
    let achadas = 0;
    for (const f of todos.filter((x) => /\.tsx?$/.test(x))) {
      const src = fs.readFileSync(f, "utf8");
      for (const m of src.matchAll(/(?<![\w-])transition(?:-[\w[\],-]+)?(?![\w:=-])/g)) {
        const cls = m[0];
        achadas++;
        if (!PERMITIDAS.has(cls)) ruins.push(`${path.basename(f)}: ${cls}`);
      }
    }
    expect(achadas).toBeGreaterThan(0);
    expect(ruins).toEqual([]);
  });

  it("keyframes do CSS animam só opacity e transform", () => {
    const ruins: string[] = [];
    let keyframes = 0;
    for (const f of todos.filter((x) => x.endsWith(".css"))) {
      const css = fs.readFileSync(f, "utf8");
      for (const kf of css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)) {
        keyframes++;
        // Exceção deliberada, só do desenho dos gráficos (keyframes v2-g-*): a linha é traçada por
        // clip-path e a rosca é varrida por stroke-dashoffset, que não têm equivalente em transform.
        const permitidas = kf[1].startsWith("v2-g-") ? ["opacity", "transform", "clip-path", "stroke-dashoffset"] : ["opacity", "transform"];
        for (const decl of kf[2].matchAll(/([a-z-]+)\s*:/g)) {
          if (!permitidas.includes(decl[1])) ruins.push(`${kf[1]}: ${decl[1]}`);
        }
      }
    }
    expect(keyframes).toBeGreaterThan(0);
    expect(ruins).toEqual([]);
  });

  it("Motion anima só opacity e y nas variantes compartilhadas", () => {
    const src = fs.readFileSync(path.join(RAIZ, "motion/variants.ts"), "utf8");
    const props = new Set<string>();
    for (const m of src.matchAll(/\b(?:oculto|visivel|saindo):\s*\{([^}]*)\}/g)) {
      for (const k of m[1].matchAll(/(\w+):/g)) props.add(k[1]);
    }
    expect(props.size).toBeGreaterThan(0);
    for (const p of props) expect(["opacity", "y", "transition", "duration", "ease"]).toContain(p);
  });
});
