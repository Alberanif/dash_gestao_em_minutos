/**
 * Decide se o herói roda o WebGL, fica pausado ou usa só o CSS. Função pura: todo
 * o ambiente entra por parâmetro, para o teste cobrir cada combinação sem navegador.
 */
export type Ambiente = {
  reducedMotion: boolean;
  webgl: boolean;
  fraco: boolean;
  abaOculta: boolean;
  naTela: boolean;
  contextoPerdido: boolean;
};

export type ModoHeroi = "css" | "webgl-rodando" | "webgl-pausado";

export function decidirModo(a: Ambiente): ModoHeroi {
  if (a.reducedMotion || !a.webgl || a.fraco || a.contextoPerdido) return "css";
  if (a.abaOculta || !a.naTela) return "webgl-pausado";
  return "webgl-rodando";
}

export type SinaisDoDispositivo = {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
};

/** Dispositivo fraco: pouca memória, poucos núcleos ou economia de dados ligada. */
export function dispositivoFraco(s: SinaisDoDispositivo): boolean {
  if (s.saveData) return true;
  if (s.deviceMemory !== undefined && s.deviceMemory < 4) return true;
  if (s.hardwareConcurrency !== undefined && s.hardwareConcurrency < 4) return true;
  return false;
}

/** Quadros por segundo alvo: 60 no desktop, 30 em tela estreita ou toque. */
export function fpsAlvo(larguraViewport: number, toqueGrosso: boolean): 30 | 60 {
  return larguraViewport < 768 || toqueGrosso ? 30 : 60;
}

/** Limite do devicePixelRatio: o feixe é difuso, não precisa de resolução nativa. */
export function limiteDpr(dpr: number, fps: 30 | 60): number {
  return Math.min(dpr, fps === 30 ? 1 : 1.5);
}
