import { dispositivoFraco, type SinaisDoDispositivo } from "../evento/hero-decisao";

/**
 * completo: traçado de 1,2 s com escalonamento. curto: aparelho fraco, 0,6 s e sem escalonamento.
 * reduzido: prefers-reduced-motion, só um fade curto.
 */
export type PerfilMovimento = "completo" | "curto" | "reduzido";

/** Função pura: o ambiente entra por parâmetro, como em decidirModo, para o teste cobrir cada caso. */
export function decidirPerfil(reducedMotion: boolean, sinais: SinaisDoDispositivo): PerfilMovimento {
  if (reducedMotion) return "reduzido";
  return dispositivoFraco(sinais) ? "curto" : "completo";
}

/** Sinais do navegador usados pelo herói e pelo desenho dos gráficos. */
export function sinaisDoNavegador(): SinaisDoDispositivo {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    deviceMemory: n.deviceMemory,
    hardwareConcurrency: n.hardwareConcurrency,
    saveData: n.connection?.saveData,
  };
}
