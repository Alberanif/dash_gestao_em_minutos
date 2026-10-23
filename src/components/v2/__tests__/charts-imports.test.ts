import fs from "fs";
import path from "path";

/**
 * Critério da #254: a rota que importa um gráfico não puxa pacotes visx não usados.
 * Só estes pacotes entram, sempre por módulo (nunca o agregador "@visx/visx").
 */
const PERMITIDOS = new Set(["@visx/shape", "@visx/curve"]);
const RAIZ = path.resolve(__dirname, "..");
const CHARTS = path.join(RAIZ, "charts");
const fontes = fs.readdirSync(CHARTS).filter((f) => /\.tsx?$/.test(f));

const importsDe = (src: string) => [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);

describe("biblioteca de gráficos: dependências", () => {
  it("encontra os arquivos", () => {
    expect(fontes.length).toBeGreaterThan(8);
  });

  it("importa só pacotes visx permitidos e nunca Recharts nem d3 direto", () => {
    const ruins: string[] = [];
    let visx = 0;
    for (const f of fontes) {
      for (const imp of importsDe(fs.readFileSync(path.join(CHARTS, f), "utf8"))) {
        if (imp.startsWith("@visx/")) {
          visx++;
          if (!PERMITIDOS.has(imp)) ruins.push(`${f}: ${imp}`);
        }
        if (/^(recharts|d3(-|$)|chart\.js|echarts)/.test(imp)) ruins.push(`${f}: ${imp}`);
      }
    }
    expect(visx).toBeGreaterThan(2);
    expect(ruins).toEqual([]);
  });

  it("package.json declara só os pacotes visx permitidos", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(RAIZ, "../../../package.json"), "utf8"));
    const declarados = Object.keys(pkg.dependencies ?? {}).filter((d) => d.startsWith("@visx/"));
    expect(declarados.sort()).toEqual(["@visx/curve", "@visx/shape"]);
  });
});

describe("o âmbar é só o último ponto da linha", () => {
  it("só line-chart e sparkline usam COR.ponto", () => {
    const usam = fontes.filter((f) => f !== "palette.ts" && /COR\.ponto|--v2-ponto/.test(fs.readFileSync(path.join(CHARTS, f), "utf8")));
    expect(usam.sort()).toEqual(["line-chart.tsx", "sparkline.tsx"]);
  });
});

describe("animação só com transform e opacity", () => {
  it("os gráficos animam apenas scale, opacity e y", () => {
    const ruins: string[] = [];
    let achadas = 0;
    for (const f of fontes.filter((x) => x.endsWith(".tsx"))) {
      const src = fs.readFileSync(path.join(CHARTS, f), "utf8");
      // Objetos literais passados a initial/animate/exit (a linha toda, inclusive dentro de ternários).
      for (const linha of src.match(/(?:initial|animate|exit)=\{[^\n]*/g) ?? []) {
        for (const obj of linha.matchAll(/\{([^{}]*)\}/g)) {
          for (const k of obj[1].matchAll(/([a-zA-Z]+)\s*:/g)) {
            achadas++;
            if (!["scaleX", "scaleY", "scale", "opacity", "y", "x"].includes(k[1])) ruins.push(`${f}: ${k[1]}`);
          }
        }
      }
    }
    expect(achadas).toBeGreaterThan(3);
    expect(ruins).toEqual([]);
  });
});
