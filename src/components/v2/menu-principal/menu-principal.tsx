import Image from "next/image";
import { canManageSettings, type ActiveRole } from "@/types/auth";
import { CartaoGiro, type CartaoDoMenu } from "./cartao-giro";

/** Ícones de traço fino, na cor do cartão em tom apagado (ver .v2-menu-icone no CSS). */
const TRACO = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const ICONE_INDICADORES = (
  <svg {...TRACO}>
    <path d="M4 20V10" />
    <path d="M10 20V4" />
    <path d="M16 20v-7" />
    <path d="M22 20H2" />
  </svg>
);

const ICONE_LINKS = (
  <svg {...TRACO}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

const ICONE_CONFIGURACOES = (
  <svg {...TRACO}>
    <path d="M4 7h10" />
    <path d="M18 7h2" />
    <circle cx="16" cy="7" r="2" />
    <path d="M4 17h2" />
    <path d="M10 17h10" />
    <circle cx="8" cy="17" r="2" />
  </svg>
);

const ICONE_GESTAO_A_VISTA = (
  <svg {...TRACO}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ICONE_BASE_DE_DADOS = (
  <svg {...TRACO}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const ICONE_VENDAS = (
  <svg {...TRACO}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);

const ICONE_SAIR = (
  <svg {...TRACO}>
    <path d="M9 4H5v16h4" />
    <path d="M16 8l4 4-4 4" />
    <path d="M20 12H9" />
  </svg>
);

const CARTAO_INDICADORES: CartaoDoMenu = {
  id: "indicadores",
  href: "/v2/indicadores",
  titulo: "Indicadores",
  icone: ICONE_INDICADORES,
  descricao: "KPIs de campanhas, Meta Ads, Google Ads e leads orgânicos",
  destaque: "#6ec3ea",
  tamanho: "grande",
};

const CARTAO_CENTRAL_DE_LINKS: CartaoDoMenu = {
  id: "central-de-links",
  href: "/v2/central-de-links",
  titulo: "Central de links",
  icone: ICONE_LINKS,
  descricao: "Guarda em um só lugar os links dos projetos",
  destaque: "#8fb3a3",
  tamanho: "grande",
};

const CARTAO_RELATORIO_DE_VENDAS: CartaoDoMenu = {
  id: "relatorio-de-vendas",
  href: "/v2/relatorio-de-vendas",
  titulo: "Relatório de vendas",
  icone: ICONE_VENDAS,
  descricao: "Visualizações de vendas por produto e oferta da Hotmart",
  destaque: "#d9b26a",
  tamanho: "grande",
};

const CARTAO_CONFIGURACOES: CartaoDoMenu = {
  id: "configuracoes",
  href: "/v2/ajustes",
  titulo: "Configurações",
  icone: ICONE_CONFIGURACOES,
  descricao: "Ajustes do projeto e gerenciamento de dados",
  destaque: "#8fa6b5",
  tamanho: "pequeno",
};

const CARTAO_SAIR: CartaoDoMenu = {
  id: "sair",
  titulo: "Sair",
  icone: ICONE_SAIR,
  descricao: "Encerra a sua sessão",
  destaque: "#a8939b",
  tamanho: "mini",
};

/**
 * Cartões das áreas de trabalho da V2, em blocos como os do Windows Phone: as áreas são grandes e as ações
 * simples (Configurações, Sair) são menores. Configurações leva ao hub de Ajustes e é só do gestor — o
 * analista não vê o cartão. O Relatório de vendas atende gestor e analista. Sair encerra a sessão.
 */
export function cartoesDoMenu(role: ActiveRole): CartaoDoMenu[] {
  return [
    CARTAO_INDICADORES,
    CARTAO_CENTRAL_DE_LINKS,
    // Mesmo público da tela: o papel legado (comum) é levado à Base de Dados.
    ...(role !== "comum" ? [CARTAO_RELATORIO_DE_VENDAS] : []),
    ...(canManageSettings(role) ? [CARTAO_CONFIGURACOES] : []),
    CARTAO_SAIR,
  ];
}

/**
 * Áreas que ainda não têm versão V2 e abrem no layout anterior, nos endereços de sempre. Saem desta lista
 * (e ganham cartão no menu acima) quando a V2 delas existir. O selo "V1" avisa que a tela muda de visual.
 */
export const CARTOES_DO_LAYOUT_ANTERIOR: readonly CartaoDoMenu[] = [
  {
    id: "gestao-a-vista",
    href: "/dashboard",
    titulo: "Gestão à Vista",
    icone: ICONE_GESTAO_A_VISTA,
    descricao: "Painéis de EQA, posicionamento, relacionamento e Meta Ads",
    destaque: "#7fa6e8",
    tamanho: "pequeno",
    selo: "V1",
  },
  {
    id: "base-de-dados",
    href: "/base-de-dados",
    titulo: "Base de Dados",
    icone: ICONE_BASE_DE_DADOS,
    descricao: "Atenção, EQA, Convite e Entrega Nível A",
    destaque: "#7fbf9a",
    tamanho: "pequeno",
    selo: "V1",
  },
];

/** Menu principal da V2: a capa mostra ícone e nome; o verso (hover ou foco) mostra nome e descrição. */
export function MenuPrincipal({ saudacao, nome, role }: { saudacao: string; nome: string; role: ActiveRole }) {
  return (
    <div className="v2-menu-pagina">
      <header className="v2-menu-cabecalho">
        <Image src="/igt-logo.png" alt="IGT" width={64} height={64} priority className="v2-menu-logo" />
        <h1 className="v2-menu-titulo">{nome ? `${saudacao}, ${nome}` : saudacao}</h1>
      </header>
      <nav aria-label="Módulos" className="v2-menu">
        {cartoesDoMenu(role).map((c) => (
          <CartaoGiro key={c.id} c={c} />
        ))}
      </nav>
      <nav aria-label="Áreas do layout anterior" className="v2-menu-legado">
        {CARTOES_DO_LAYOUT_ANTERIOR.map((c) => (
          <CartaoGiro key={c.id} c={c} />
        ))}
      </nav>
    </div>
  );
}
