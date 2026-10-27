import type { PerfilMovimento } from "../motion/perfil-movimento";

/** Duração da aproximação por perfil; a navegação acontece quando ela termina. */
export const DURACAO_ENTRADA: Record<PerfilMovimento, number> = {
  completo: 480,
  curto: 260,
  reduzido: 160,
};

export type CaixaDoCard = { left: number; top: number; width: number; height: number };
export type Viewport = { width: number; height: number };
export type Zoom = { dx: number; dy: number; escala: number };

/**
 * Deslocamento e escala (uniforme) que levam o card do lugar onde está até cobrir a janela inteira,
 * com o centro do card indo para o centro da janela. A escala é uniforme para o desenho não distorcer.
 */
export function calcularZoom(card: CaixaDoCard, viewport: Viewport): Zoom {
  const escala = Math.max(viewport.width / card.width, viewport.height / card.height) * 1.08;
  return {
    dx: viewport.width / 2 - (card.left + card.width / 2),
    dy: viewport.height / 2 - (card.top + card.height / 2),
    escala,
  };
}

type CliqueLike = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean };

/** Clique simples com o botão principal. Ctrl, Cmd, Shift, Alt e botão do meio seguem o link nativo. */
export function cliqueSimples(e: CliqueLike): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
