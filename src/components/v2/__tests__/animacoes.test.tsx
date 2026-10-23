/** @jest-environment jsdom */
import React from "react";
import { readFileSync } from "fs";
import { join } from "path";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { decidirPerfil } from "../motion/perfil-movimento";
import { useVisto } from "../motion/use-visto";
import { CamadaAnimada } from "../charts/parts";
import { Corpo, EsqueletoGrafico } from "../evento/bloco";
import { mockReducedMotion } from "./helpers";

const css = readFileSync(join(__dirname, "../ui/ui.css"), "utf8");
const tokens = readFileSync(join(__dirname, "../tokens.css"), "utf8");

describe("perfil de movimento", () => {
  it("movimento reduzido vence qualquer aparelho", () => {
    expect(decidirPerfil(true, {})).toBe("reduzido");
    expect(decidirPerfil(true, { deviceMemory: 1 })).toBe("reduzido");
  });

  it("aparelho fraco (pouca memória, poucos núcleos ou economia de dados) usa a versão curta", () => {
    expect(decidirPerfil(false, { deviceMemory: 2 })).toBe("curto");
    expect(decidirPerfil(false, { hardwareConcurrency: 2 })).toBe("curto");
    expect(decidirPerfil(false, { saveData: true })).toBe("curto");
  });

  it("aparelho comum, ou sem sinais, usa o desenho completo", () => {
    expect(decidirPerfil(false, { deviceMemory: 8, hardwareConcurrency: 8 })).toBe("completo");
    expect(decidirPerfil(false, {})).toBe("completo");
  });
});

describe("useVisto", () => {
  const original = globalThis.IntersectionObserver;
  let callback: IntersectionObserverCallback;
  const disconnect = jest.fn();

  beforeEach(() => {
    disconnect.mockClear();
    globalThis.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect;
      takeRecords = () => [];
      root = null;
      rootMargin = "";
      thresholds = [];
    } as unknown as typeof IntersectionObserver;
  });
  afterEach(() => {
    globalThis.IntersectionObserver = original;
  });

  function Sonda() {
    const { ref, visto } = useVisto<HTMLDivElement>();
    return <div ref={ref} data-visto={visto ? "sim" : "nao"} />;
  }

  it("só vira visto quando o elemento cruza o limiar, e não volta atrás", () => {
    const { container } = render(<Sonda />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset.visto).toBe("nao");

    act(() => callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(el.dataset.visto).toBe("nao");

    act(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(el.dataset.visto).toBe("sim");

    act(() => callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(el.dataset.visto).toBe("sim");
    expect(disconnect).toHaveBeenCalled();
  });

  it("sem IntersectionObserver o conteúdo conta como visto, nunca fica preso no primeiro quadro", () => {
    // @ts-expect-error simula um navegador sem o observador
    delete globalThis.IntersectionObserver;
    expect(renderHook(() => useVisto<HTMLDivElement>()).result.current.visto).toBe(true);
    const { container } = render(<Sonda />);
    expect((container.firstElementChild as HTMLElement).dataset.visto).toBe("sim");
  });
});

describe("CamadaAnimada", () => {
  function Camada({ chave }: { chave: string }) {
    return (
      <svg>
        <CamadaAnimada animKey={chave}>
          <circle r={1} />
        </CamadaAnimada>
      </svg>
    );
  }

  it("na entrada o gráfico se desenha; depois que o dado troca, o desenho é desligado", async () => {
    mockReducedMotion(false);
    const { container, rerender } = render(<Camada chave="a" />);
    expect(container.querySelector("[data-gate]")).not.toBeNull();
    expect(container.querySelector("[data-troca]")).toBeNull();

    rerender(<Camada chave="b" />);
    // A saída do conteúdo anterior termina antes de o novo montar (AnimatePresence em modo wait).
    await waitFor(() => expect(container.querySelector("[data-troca]")).not.toBeNull());
  });
});

describe("Corpo: entrada dos blocos", () => {
  const consulta = (chave: string) =>
    ({ data: { chave, data: null }, isPlaceholderData: false, isError: false }) as unknown as Parameters<typeof Corpo>[0]["consultas"][number];

  it("a primeira entrada é escalonada pela ordem do bloco; a troca de filtro usa a entrada curta", () => {
    const { container, rerender } = render(
      <Corpo consultas={[consulta("x")]} ordem={2}>
        conteúdo
      </Corpo>,
    );
    const entrada = container.querySelector(".v2-entra-bloco") as HTMLElement;
    expect(entrada).not.toBeNull();
    expect(entrada.style.getPropertyValue("--i")).toBe("2");

    rerender(
      <Corpo consultas={[consulta("y")]} ordem={2}>
        conteúdo
      </Corpo>,
    );
    expect(container.querySelector(".v2-entra-bloco")).toBeNull();
    expect(container.querySelector(".v2-entra")).not.toBeNull();
  });

  it("sem dado, com formas, mostra o esqueleto de cada gráfico", () => {
    const { container } = render(
      <Corpo consultas={[{ data: undefined, isError: false } as never]} formas={["rosca", "linha"]}>
        x
      </Corpo>,
    );
    expect(container.querySelectorAll(".v2-esq").length).toBe(2);
  });
});

describe("EsqueletoGrafico", () => {
  it("cada forma desenha o que vai chegar", () => {
    const linha = render(<EsqueletoGrafico forma="linha" />).container;
    expect(linha.querySelectorAll(".h-px").length).toBe(5);
    const barras = render(<EsqueletoGrafico forma="barras" />).container;
    expect(barras.querySelectorAll(".rounded-full").length).toBe(5);
    const funil = render(<EsqueletoGrafico forma="funil" />).container;
    expect(funil.querySelectorAll(".h-6").length).toBe(4);
    const rosca = render(<EsqueletoGrafico forma="rosca" />).container;
    expect(rosca.querySelector(".aspect-square")).not.toBeNull();
  });
});

describe("tokens e CSS do desenho", () => {
  it("as durações aprovadas estão nos tokens", () => {
    expect(tokens).toMatch(/--v2-dur-traco:\s*1200ms/);
    expect(tokens).toMatch(/--v2-dur-contagem:\s*1400ms/);
    expect(tokens).toMatch(/--v2-dur-filtro:\s*380ms/);
    expect(tokens).toMatch(/--v2-dur-brilho:\s*1800ms/);
    expect(tokens).toMatch(/--v2-escalona-item:\s*60ms/);
    expect(tokens).toMatch(/--v2-atraso-ponto:\s*1000ms/);
    expect(tokens).toMatch(/--v2-dur-pulso:\s*600ms/);
  });

  it("aparelho fraco: traçado de 600 ms e sem escalonamento", () => {
    const bloco = css.match(/\.v2\[data-movimento="curto"\]\s*\{([^}]*)\}/);
    expect(bloco).not.toBeNull();
    expect(bloco![1]).toMatch(/--v2-dur-traco:\s*600ms/);
    expect(bloco![1]).toMatch(/--v2-escalona-item:\s*0ms/);
  });

  it("o desenho espera o gráfico entrar na tela e desliga na troca de filtro", () => {
    expect(css).toMatch(/\[data-gate\]:not\(\[data-visto\]\) \.v2-g\s*\{\s*animation-play-state:\s*paused/);
    expect(css).toMatch(/\[data-troca\] \.v2-g\s*\{\s*animation:\s*none/);
  });
});
