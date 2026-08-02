// Vínculo entre um ciclo do Dash Ultimates e a base de inscritos com a qual as
// compras dele são cruzadas ("de onde vem a venda").
//
// É um MAPA FIXO NO CÓDIGO de propósito, e não uma tabela de configuração. O
// nome da tabela de origem é interpolado no `select` do PostgREST pela rota
// /api/ultimates/cycles/[id]/origin-breakdown; vindo daqui ele é constante de
// compilação e não há superfície de injeção. Vindo do banco, haveria — e não
// existe FK que garanta que a tabela apontada sequer exista, porque essas bases
// de evento são criadas FORA da fila de migrations deste repo (mesma situação
// de dash_gestao_hotmart_sales, ver o comentário na migration 049).
//
// Consequência aceita: plugar um segundo evento exige deploy. Foi a troca
// escolhida — hoje existe exatamente um ciclo com cruzamento de origem.

export interface OriginDimension {
  // Identifica o bloco na resposta da API e na key do React.
  key: string;
  // Título do bloco na tela.
  title: string;
  // Coluna da tabela de origem que classifica a pessoa. CONSTANTE DE CÓDIGO —
  // nunca aceite este valor de request, ver o comentário do topo.
  column: string;
}

export interface OriginSourceConfig {
  // Tabela de inscritos do evento. Fora do controle de migrations.
  table: string;
  // Coluna de email, usada como chave do cruzamento.
  emailColumn: string;
  // Descrição curta exibida no cabeçalho da seção.
  desc: string;
  dimensions: OriginDimension[];
}

const ORIGIN_SOURCES: Record<string, OriginSourceConfig> = {
  // Ciclo "Pitch PC Ao Vivo - 2026".
  "fa6160b9-984b-44a5-8171-8cddd5f18775": {
    table: "pc_ao_vivo_26_compras",
    emailColumn: "email",
    desc: "Cruzamento das compras com a base de inscritos do evento",
    dimensions: [
      { key: "modalidade", title: "Por modalidade", column: "modalidade" },
      { key: "categoria", title: "Por categoria", column: "categoria" },
    ],
  },
};

// `null` = este ciclo não cruza com base nenhuma, que é o caso de todos os
// ciclos menos um. Quem consome esconde a seção inteira — ausência de
// configuração NÃO é erro e não deve virar mensagem na tela.
export function originSourceFor(cycleId: string): OriginSourceConfig | null {
  return ORIGIN_SOURCES[cycleId] ?? null;
}
