/** Forma do JSON de GET /api/central-de-links/ab-resultado (idêntica à de api/ab-resultado.js do original). */
export type EstadoDoTeste = "rascunho" | "ativo" | "encerrado";

export const DIMENSOES = [
  { chave: "utm_source", rotulo: "Origem (utm_source)", curto: "Origem" },
  { chave: "utm_medium", rotulo: "Mídia (utm_medium)", curto: "Mídia" },
  { chave: "utm_campaign", rotulo: "Campanha (utm_campaign)", curto: "Campanha" },
  { chave: "dispositivo", rotulo: "Dispositivo", curto: "Dispositivo" },
  { chave: "pais", rotulo: "País", curto: "País" },
] as const;

export type DimensaoChave = (typeof DIMENSOES)[number]["chave"];
export type FiltrosDoResultado = Partial<Record<DimensaoChave, string>>;

export interface TesteDoResultado {
  id: string;
  nome: string;
  status: EstadoDoTeste;
  iniciado_em: string | null;
  encerrado_em: string | null;
  vencedor_variante: string | null;
  anotacao: string | null;
}

export interface EstatisticaDaVariante {
  diferenca_abs: number | null;
  diferenca_rel: number | null;
  p_valor: number | null;
  confianca: number | null;
  faltam: number | null;
  veredito: string | null;
}

export interface PontoDaSerie {
  dia: string;
  visitantes: number;
  leads: number;
  conversao: number;
}

export interface CorteDaVariante {
  dimensao: string;
  valor: string | null;
  visitantes: number;
  leads: number;
  conversao: number;
}

export interface VarianteDoResultado {
  id: string;
  rotulo: string;
  controle: boolean;
  link_id: string;
  pagina: string | null;
  url: string | null;
  visualizacoes: number;
  unicos: number;
  novos: number;
  recorrentes: number;
  leads: number;
  envios: number;
  conversao: number;
  funil: { visitaram: number; comecaram: number; enviaram: number };
  estatistica: EstatisticaDaVariante;
  serie: PontoDaSerie[];
  cortes: CorteDaVariante[];
  saude: { ultimo_evento: string | null; horas_sem_evento: number | null; alerta: boolean };
}

export type ResultadoDoVeredito = "vencedor" | "cedo_demais" | "sem_diferenca" | string;

export interface VereditoGeral {
  resultado: ResultadoDoVeredito;
  vencedor_id: string | null;
  avisos: string[];
  confianca_minima: number;
  amostra_minima: number;
  controle_id: string | null;
}

export interface ResultadoAb {
  teste: TesteDoResultado;
  filtros_aplicados: FiltrosDoResultado;
  filtros_disponiveis: Record<DimensaoChave, string[]>;
  veredito: VereditoGeral;
  horas_sem_evento_alerta: number;
  variantes: VarianteDoResultado[];
}
