import type { FilterStatus } from "@/types/indicadores";

export interface PastaConfig {
  status: FilterStatus;
  nome: string;
  descricao: string;
  rotuloResumo: string;
  /** Classes do marcador de status. O âmbar (ponto) marca só o que está vivo agora. */
  marcador: string;
}

export const PASTAS: readonly PastaConfig[] = [
  {
    status: "ativo",
    nome: "Eventos ativos",
    descricao: "Em captação ou veiculação agora",
    rotuloResumo: "Ativos",
    marcador: "bg-v2-ponto shadow-v2-brilho-ponto",
  },
  {
    status: "finalizado",
    nome: "Eventos finalizados",
    descricao: "Encerrados, com dados consolidados",
    rotuloResumo: "Finalizados",
    marcador: "bg-v2-azul-luz",
  },
  {
    status: "cancelado",
    nome: "Eventos cancelados",
    descricao: "Interrompidos antes da conclusão",
    rotuloResumo: "Cancelados",
    marcador: "bg-v2-queda",
  },
];

/** Estado inicial das pastas: ativos abertos, o resto recolhido (igual ao V1). */
export const PASTAS_RECOLHIDAS_INICIAL: Record<FilterStatus, boolean> = {
  ativo: false,
  finalizado: true,
  cancelado: true,
};

/** Destino do dashboard do evento (entregue pela #259). */
export function hrefDoEvento(id: string): string {
  return `/v2/indicadores/${id}`;
}
