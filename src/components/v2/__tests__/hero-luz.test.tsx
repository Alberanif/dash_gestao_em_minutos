/** @jest-environment jsdom */
import React from "react";
import { act, render } from "@testing-library/react";
import { HeroLuz } from "../evento/hero-luz";
import { mockReducedMotion } from "./helpers";

const desenhar = jest.fn();
const destruir = jest.fn();
const criarCena = jest.fn(() => ({ desenhar, redimensionar: jest.fn(), destruir }));
jest.mock("../evento/hero-cena", () => ({ criarCena: (...a: unknown[]) => (criarCena as (...x: unknown[]) => unknown)(...a) }));

let intersecta: (e: { isIntersecting: boolean }) => void = () => {};

beforeEach(() => {
  jest.clearAllMocks();
  (window as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback = (cb) => {
    cb();
    return 1;
  };
  (window as unknown as { cancelIdleCallback: () => void }).cancelIdleCallback = () => {};
  global.IntersectionObserver = class {
    constructor(cb: typeof intersecta) {
      intersecta = (e) => cb([e as never] as never);
    }
    observe() {
      intersecta({ isIntersecting: true });
    }
    disconnect() {}
  } as never;
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  } as never;
  Object.defineProperty(navigator, "hardwareConcurrency", { value: 8, configurable: true });
});

const tick = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe("HeroLuz", () => {
  it("cria a cena WebGL e mostra o canvas quando o ambiente permite", async () => {
    mockReducedMotion(false);
    const { container } = render(<HeroLuz />);
    await tick();
    expect(criarCena).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-hero-luz]")?.getAttribute("data-webgl")).toBe("on");
  });

  it("com movimento reduzido nunca carrega a cena e fica no CSS", async () => {
    mockReducedMotion(true);
    const { container } = render(<HeroLuz />);
    await tick();
    expect(criarCena).not.toHaveBeenCalled();
    expect(container.querySelector("[data-hero-luz]")?.getAttribute("data-webgl")).toBe("off");
  });

  it("em dispositivo fraco fica no CSS", async () => {
    mockReducedMotion(false);
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 2, configurable: true });
    render(<HeroLuz />);
    await tick();
    expect(criarCena).not.toHaveBeenCalled();
  });

  it("se a criação do contexto falha, o CSS continua e nada quebra", async () => {
    mockReducedMotion(false);
    criarCena.mockImplementationOnce(() => {
      throw new Error("sem webgl");
    });
    const { container } = render(<HeroLuz />);
    await tick();
    expect(container.querySelector("[data-hero-luz]")?.getAttribute("data-webgl")).toBe("off");
  });

  it("libera o contexto ao desmontar", async () => {
    mockReducedMotion(false);
    const { unmount } = render(<HeroLuz />);
    await tick();
    unmount();
    expect(destruir).toHaveBeenCalledTimes(1);
  });

  it("perda de contexto volta para o CSS", async () => {
    mockReducedMotion(false);
    const { container } = render(<HeroLuz />);
    await tick();
    await act(async () => {
      container.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    expect(container.querySelector("[data-hero-luz]")?.getAttribute("data-webgl")).toBe("off");
  });

  it("depois de perder o contexto, voltar à tela não recria a cena", async () => {
    mockReducedMotion(false);
    const { container } = render(<HeroLuz />);
    await tick();
    await act(async () => {
      container.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    await act(async () => {
      intersecta({ isIntersecting: false });
      intersecta({ isIntersecting: true });
    });
    await tick();
    expect(criarCena).toHaveBeenCalledTimes(1);
  });

  it("depois de falhar ao criar, não tenta de novo a cada retorno à tela", async () => {
    mockReducedMotion(false);
    criarCena.mockImplementationOnce(() => {
      throw new Error("sem webgl");
    });
    render(<HeroLuz />);
    await tick();
    await act(async () => {
      intersecta({ isIntersecting: false });
      intersecta({ isIntersecting: true });
    });
    await tick();
    expect(criarCena).toHaveBeenCalledTimes(1);
  });

  it("sai da tela: cancela o laço de animação sem destruir a cena", async () => {
    mockReducedMotion(false);
    const raf = jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 7);
    const cancela = jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    render(<HeroLuz />);
    await tick();
    expect(raf).toHaveBeenCalled();
    await act(async () => intersecta({ isIntersecting: false }));
    expect(cancela).toHaveBeenCalledWith(7);
    expect(destruir).not.toHaveBeenCalled();
    raf.mockRestore();
    cancela.mockRestore();
  });
});
