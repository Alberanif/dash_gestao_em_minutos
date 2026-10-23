import { Mesh, Program, Renderer, Triangle } from "ogl";

/**
 * Cena WebGL do herói: só o feixe de luz azul. O ponto âmbar fica no DOM (hero-slot),
 * então o âmbar nunca passa pelo shader nem vira degradê. Este módulo é o único que
 * importa a OGL e só é carregado por import dinâmico.
 */
const VERT = /* glsl */ `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// Azul luz #6EC3EA. x do feixe vem em uCentro (0..1 da largura); y=0 é a base (onde está o ponto).
const FRAG = /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform float uTempo;
uniform float uAspecto;
uniform float uCentro;
uniform float uLargura;
void main() {
  float dx = (vUv.x - uCentro) * uAspecto;
  float sway = sin(vUv.y * 2.0 + uTempo * 0.5) * 0.008;
  float d = dx + sway;
  float nucleo = exp(-(d * d) / (uLargura * uLargura * 0.18));
  float halo = exp(-(d * d) / (uLargura * uLargura * 1.6));
  float fade = smoothstep(0.0, 0.22, vUv.y) * (1.0 - smoothstep(0.78, 1.0, vUv.y));
  float poeira = 0.93 + 0.07 * sin(vUv.y * 9.0 - uTempo * 0.8);
  float a = (nucleo * 0.5 + halo * 0.34) * fade * poeira;
  gl_FragColor = vec4(vec3(0.431, 0.765, 0.918) * a, a);
}`;

export type Cena = {
  /** Desenha um quadro no instante `ms`. */
  desenhar(ms: number): void;
  redimensionar(largura: number, altura: number): void;
  destruir(): void;
};

export type OpcoesCena = {
  canvas: HTMLCanvasElement;
  dpr: number;
  /** Posição horizontal do feixe (0 a 1) e largura relativa à altura. */
  centro: number;
  largura: number;
};

export function criarCena({ canvas, dpr, centro, largura }: OpcoesCena): Cena {
  const renderer = new Renderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false, dpr, depth: false });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    transparent: true,
    uniforms: { uTempo: { value: 0 }, uAspecto: { value: 1 }, uCentro: { value: centro }, uLargura: { value: largura } },
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  return {
    desenhar(ms) {
      program.uniforms.uTempo.value = ms / 1000;
      renderer.render({ scene: mesh });
    },
    redimensionar(w, h) {
      renderer.setSize(w, h);
      program.uniforms.uAspecto.value = w / Math.max(h, 1);
    },
    destruir() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
