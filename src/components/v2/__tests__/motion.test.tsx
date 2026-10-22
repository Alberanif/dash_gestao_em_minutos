/** @jest-environment jsdom */
import React from "react";
import { render, screen, renderHook } from "@testing-library/react";
import { CountUp, FilterTransition, MotionProvider, useReducedMotion } from "../motion";
import { mockReducedMotion } from "./helpers";

describe("useReducedMotion", () => {
  it("reflete prefers-reduced-motion: reduce", () => {
    mockReducedMotion(true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
    mockReducedMotion(false);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });
});

describe("CountUp", () => {
  it("com movimento reduzido mostra o valor final na hora", () => {
    mockReducedMotion(true);
    const { container } = render(<CountUp value={5000} format={(n) => `R$ ${Math.round(n)}`} />);
    expect(container.textContent).toBe("R$ 5000");
  });

  it("com movimento permitido começa em `from`, não no valor final", () => {
    mockReducedMotion(false);
    const { container } = render(<CountUp value={5000} from={10} format={(n) => `R$ ${Math.round(n)}`} />);
    expect(container.textContent).toBe("R$ 10");
  });

  it("expõe o valor final para leitores de tela mesmo durante a contagem", () => {
    mockReducedMotion(false);
    const { container } = render(<CountUp value={5000} format={(n) => `R$ ${Math.round(n)}`} />);
    expect(container.querySelector("span")?.getAttribute("aria-label")).toBe("R$ 5000");
  });
});

describe("FilterTransition", () => {
  it("renderiza o conteúdo do filtro atual", () => {
    mockReducedMotion(true);
    render(
      <MotionProvider>
        <FilterTransition filtroKey="a">
          <p>conteúdo A</p>
        </FilterTransition>
      </MotionProvider>,
    );
    expect(screen.getByText("conteúdo A")).toBeTruthy();
  });
});
