import type { DebriefingProduct, FilterRecord } from "@/types/indicadores";
import { validateEventPeriod } from "@/lib/indicadores/event-period";
import { validateOrganicSources } from "@/lib/indicadores/organic-validation";
import { getPartialFilterWarning } from "@/components/indicadores/filter-modal";

/** Contrato do assistente "Novo evento": estado, regras e corpo do POST. Sem React. */

export const ETAPAS = [
  { id: "identificacao", rotulo: "Identificação" },
  { id: "captacao", rotulo: "Captação" },
  { id: "produto", rotulo: "Produto principal" },
  { id: "trafego", rotulo: "Tráfego" },
  { id: "revisao", rotulo: "Revisão" },
] as const;

export type EtapaId = (typeof ETAPAS)[number]["id"];

export interface ProdutoHotmart {
  product_id: string;
  product_name: string;
}

export interface EstadoAssistente {
  nome: string;
  /** AAAA-MM-DD ou "" (opcional). */
  inicio: string;
  fim: string;
  organico: boolean;
  /** Produtos Hotmart de captura. Preservados quando `organico` liga: nunca são apagados. */
  produtosCaptura: ProdutoHotmart[];
  /** Eventos de Captação de Leads (a "página de leads"). */
  eventosLeads: string[];
  /** Produtos do Debriefing, cada um com as ofertas escolhidas (vazio = todas). */
  produtosPrincipais: DebriefingProduct[];
  /** Período de vendas do produto principal (AAAA-MM-DD ou ""). Só vale com produto principal escolhido. */
  debriefingInicio: string;
  debriefingFim: string;
  /** Termos de campanha do Meta Ads, como digitados (podem ter vazios). */
  termos: string[];
}

export const estadoInicial: EstadoAssistente = {
  nome: "",
  inicio: "",
  fim: "",
  organico: false,
  produtosCaptura: [],
  eventosLeads: [],
  produtosPrincipais: [],
  debriefingInicio: "",
  debriefingFim: "",
  termos: [""],
};

/** Props de toda etapa: lê o estado e atualiza só o que mudou. */
export interface PropsEtapa {
  estado: EstadoAssistente;
  atualizar: (parcial: Partial<EstadoAssistente>) => void;
}

/** Props do assistente: o botão "Novo evento" cria; o menu do cartão passa `evento` para editar. */
export interface PropsAssistente {
  accountId: string;
  onFechar: () => void;
  /** Evento existente: o assistente abre preenchido e salva com PUT em vez de criar. */
  evento?: FilterRecord;
}

/** Estado do assistente a partir de um evento já salvo. Sem termos, mantém o campo vazio de sempre. */
export function estadoDoEvento(f: FilterRecord): EstadoAssistente {
  return {
    nome: f.name,
    inicio: f.start_date ?? "",
    fim: f.end_date ?? "",
    organico: f.is_organic,
    produtosCaptura: f.hotmart_products ?? [],
    eventosLeads: f.captacao_leads_eventos ?? [],
    produtosPrincipais: f.debriefing_products ?? [],
    debriefingInicio: f.debriefing_start_date ?? "",
    debriefingFim: f.debriefing_end_date ?? "",
    termos: f.meta_ads_terms?.length ? f.meta_ads_terms : [""],
  };
}

export interface Problema {
  /** Etapa que resolve o problema: a Revisão usa para marcar e levar o usuário até lá. */
  etapa: EtapaId;
  mensagem: string;
}

export function termosLimpos(termos: string[]): string[] {
  return termos.map((t) => t.trim()).filter(Boolean);
}

export const ROTULO_PERIODO_PRODUTO = "de vendas do produto principal";

/** Validação do período do produto principal: sem produto principal o período é ignorado. */
export function periodoProdutoPrincipal(e: EstadoAssistente) {
  if (e.produtosPrincipais.length === 0) return validateEventPeriod("", "", ROTULO_PERIODO_PRODUTO);
  return validateEventPeriod(e.debriefingInicio, e.debriefingFim, ROTULO_PERIODO_PRODUTO);
}

/** Bloqueios que impedem criar. Lista vazia = pode criar. */
export function problemasDoEstado(e: EstadoAssistente): Problema[] {
  const problemas: Problema[] = [];
  if (!e.nome.trim()) problemas.push({ etapa: "identificacao", mensagem: "Dê um nome ao evento." });
  const periodo = validateEventPeriod(e.inicio, e.fim);
  if (!periodo.ok) problemas.push({ etapa: "identificacao", mensagem: periodo.error });

  const periodoProduto = periodoProdutoPrincipal(e);
  if (!periodoProduto.ok) problemas.push({ etapa: "produto", mensagem: periodoProduto.error });

  const termos = termosLimpos(e.termos);
  if (e.organico) {
    if (validateOrganicSources(termos, e.eventosLeads) !== null) {
      problemas.push({
        etapa: "captacao",
        mensagem: "Captação orgânica exige pelo menos um evento de Captação de Leads ou um termo de campanha Meta Ads.",
      });
    }
  } else if (e.produtosCaptura.length === 0 && termos.length === 0 && e.eventosLeads.length === 0) {
    problemas.push({
      etapa: "captacao",
      mensagem: "Escolha pelo menos um produto, termo de campanha ou evento de Captação de Leads.",
    });
  }
  return problemas;
}

/** Aviso (não bloqueia): fontes que ficariam zeradas no dashboard. */
export function avisoFontes(e: EstadoAssistente): string | null {
  return getPartialFilterWarning(e.produtosCaptura, termosLimpos(e.termos), e.eventosLeads, e.organico);
}

/** Corpo do POST /api/indicadores/filters. Chame só quando `problemasDoEstado` for vazio. */
export function montarCorpo(e: EstadoAssistente, accountId: string) {
  const periodo = validateEventPeriod(e.inicio, e.fim);
  const periodoProduto = periodoProdutoPrincipal(e);
  return {
    account_id: accountId,
    name: e.nome.trim(),
    hotmart_products: e.produtosCaptura,
    debriefing_products: e.produtosPrincipais,
    meta_ads_terms: termosLimpos(e.termos),
    captacao_leads_eventos: e.eventosLeads,
    is_organic: e.organico,
    ...(periodo.ok ? periodo.value : {}),
    // Sempre enviado: no PUT, vazio limpa o período salvo (inclusive ao remover o último produto principal).
    ...(periodoProduto.ok
      ? {
          debriefing_start_date: periodoProduto.value.start_date,
          debriefing_end_date: periodoProduto.value.end_date,
        }
      : {}),
  };
}
