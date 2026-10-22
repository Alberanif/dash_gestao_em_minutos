import {
  V2_BUDGET_BYTES,
  collectInitialFiles,
  evaluateRoute,
  formatReport,
  parseClientReferenceManifest,
  type RouteManifests,
} from "../index";

const manifests = (over: Partial<RouteManifests> = {}): RouteManifests => ({
  route: "/v2",
  buildManifest: {
    rootMainFiles: ["static/chunks/main.js", "static/chunks/turbopack.js"],
  },
  clientManifest: {
    entryJSFiles: { "[project]/src/app/v2/layout": ["static/chunks/layout.js"] },
    clientModules: { "[project]/src/components/v2/Hero": { chunks: ["/_next/static/chunks/hero.js"] } },
  },
  loadableManifest: {},
  ...over,
});

describe("collectInitialFiles", () => {
  it("junta runtime, layouts e componentes client", () => {
    expect(collectInitialFiles(manifests())).toEqual([
      "static/chunks/hero.js",
      "static/chunks/layout.js",
      "static/chunks/main.js",
      "static/chunks/turbopack.js",
    ]);
  });

  it("não conta polyfills (carregam com noModule)", () => {
    const m = manifests({
      buildManifest: { rootMainFiles: ["static/chunks/main.js"], polyfillFiles: ["static/chunks/poly.js"] } as never,
    });
    expect(collectInitialFiles(m)).not.toContain("static/chunks/poly.js");
  });

  it("não conta o chunk carregado sob demanda (WebGL via next/dynamic)", () => {
    const m = manifests({
      clientManifest: {
        entryJSFiles: { "[project]/src/app/v2/layout": ["static/chunks/layout.js"] },
        clientModules: { "x": { chunks: ["/_next/static/chunks/webgl.js"] } },
      },
      loadableManifest: { "src/hero.tsx -> ogl": { files: ["static/chunks/webgl.js"] } },
    });
    expect(collectInitialFiles(m)).not.toContain("static/chunks/webgl.js");
  });

  it("mantém o chunk lazy que também é entrada do layout", () => {
    const m = manifests({ loadableManifest: { a: { files: ["static/chunks/layout.js"] } } });
    expect(collectInitialFiles(m)).toContain("static/chunks/layout.js");
  });

  it("ignora arquivos que não são JS", () => {
    const m = manifests({
      clientManifest: { entryJSFiles: { a: ["static/chunks/estilo.css"] } },
    });
    expect(collectInitialFiles(m)).not.toContain("static/chunks/estilo.css");
  });
});

describe("evaluateRoute", () => {
  it("passa no limite exato e falha 1 byte acima", () => {
    expect(evaluateRoute("/v2", [{ file: "a.js", gzipBytes: V2_BUDGET_BYTES }]).over).toBe(false);
    expect(evaluateRoute("/v2", [{ file: "a.js", gzipBytes: V2_BUDGET_BYTES + 1 }]).over).toBe(true);
  });

  it("soma todos os arquivos da rota", () => {
    const r = evaluateRoute("/v2", [
      { file: "a.js", gzipBytes: 100 * 1024 },
      { file: "b.js", gzipBytes: 90 * 1024 },
    ]);
    expect(r.bytes).toBe(190 * 1024);
    expect(r.over).toBe(true);
  });

  it("o limite é 180 KB", () => {
    expect(V2_BUDGET_BYTES).toBe(180 * 1024);
  });
});

describe("parseClientReferenceManifest", () => {
  it("extrai o JSON do arquivo gerado pelo Next", () => {
    const src = `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["/v2/page"] = {"entryJSFiles":{"a":["static/chunks/x.js"]},"clientModules":{}}\n`;
    expect(parseClientReferenceManifest(src).entryJSFiles).toEqual({ a: ["static/chunks/x.js"] });
  });

  it("falha em formato inesperado em vez de passar em silêncio", () => {
    expect(() => parseClientReferenceManifest("console.log(1)")).toThrow();
  });
});

describe("formatReport", () => {
  it("marca a rota que estourou", () => {
    const out = formatReport([evaluateRoute("/v2", [{ file: "a.js", gzipBytes: V2_BUDGET_BYTES + 1 }])]);
    expect(out).toContain("ESTOUROU");
  });
});
