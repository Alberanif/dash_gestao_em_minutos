import Image from "next/image";
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

const ICONE_SAIR = (
  <svg {...TRACO}>
    <path d="M9 4H5v16h4" />
    <path d="M16 8l4 4-4 4" />
    <path d="M20 12H9" />
  </svg>
);

/**
 * Cartões do menu principal da V2, em blocos como os do Windows Phone: as áreas de trabalho são grandes e
 * as ações simples (Configurações, Sair) são menores. Configurações leva ao hub de Ajustes da V2;
 * Sair encerra a sessão.
 */
export const CARTOES_DO_MENU: readonly CartaoDoMenu[] = [
  {
    id: "indicadores",
    href: "/v2/indicadores",
    titulo: "Indicadores",
    icone: ICONE_INDICADORES,
    descricao: "KPIs de campanhas, Meta Ads, Google Ads e leads orgânicos",
    destaque: "#6ec3ea",
    tamanho: "grande",
  },
  {
    id: "central-de-links",
    href: "/v2/central-de-links",
    titulo: "Central de links",
    icone: ICONE_LINKS,
    descricao: "Guarda em um só lugar os links dos projetos",
    destaque: "#8fb3a3",
    tamanho: "grande",
  },
  {
    id: "configuracoes",
    href: "/v2/ajustes",
    titulo: "Configurações",
    icone: ICONE_CONFIGURACOES,
    descricao: "Ajustes do projeto e gerenciamento de dados",
    destaque: "#8fa6b5",
    tamanho: "pequeno",
  },
  {
    id: "sair",
    titulo: "Sair",
    icone: ICONE_SAIR,
    descricao: "Encerra a sua sessão",
    destaque: "#a8939b",
    tamanho: "mini",
  },
];

/** Menu principal da V2: a capa mostra ícone e nome; o verso (hover ou foco) mostra nome e descrição. */
export function MenuPrincipal({ saudacao, nome }: { saudacao: string; nome: string }) {
  return (
    <div className="v2-menu-pagina">
      <header className="v2-menu-cabecalho">
        <Image src="/igt-logo.png" alt="IGT" width={64} height={64} priority className="v2-menu-logo" />
        <h1 className="v2-menu-titulo">{nome ? `${saudacao}, ${nome}` : saudacao}</h1>
      </header>
      <nav aria-label="Módulos" className="v2-menu">
        {CARTOES_DO_MENU.map((c) => (
          <CartaoGiro key={c.id} c={c} />
        ))}
      </nav>
    </div>
  );
}
