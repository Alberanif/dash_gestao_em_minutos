"use client";

import { useSyncExternalStore } from "react";
import { decidirPerfil, sinaisDoNavegador, type PerfilMovimento } from "./perfil-movimento";
import { useReducedMotion } from "./use-reduced-motion";

const semAssinatura = () => () => {};
const lerFraco = () => decidirPerfil(false, sinaisDoNavegador()) === "curto";
// No servidor e na hidratação assume aparelho comum; o cliente corrige logo em seguida.
const fracoNoServidor = () => false;

/** Perfil de movimento do aparelho: reduzido (preferência), curto (aparelho fraco) ou completo. */
export function usePerfilMovimento(): PerfilMovimento {
  const reduced = useReducedMotion();
  const fraco = useSyncExternalStore(semAssinatura, lerFraco, fracoNoServidor);
  return reduced ? "reduzido" : fraco ? "curto" : "completo";
}
