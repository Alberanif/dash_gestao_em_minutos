import type { NextConfig } from "next";

/**
 * A V2 é o layout padrão: os endereços do layout anterior (V1) levam ao equivalente na V2, num único salto
 * e de forma temporária (307), para a regra poder ser revista sem ficar presa em cache de navegador. A query
 * (ex.: ?view=) segue junto. Cada regra aponta direto para o destino final, sem cadeias. As áreas que não
 * têm versão V2 (Gestão à Vista, Base de Dados, Relatório de Vendas) seguem nos endereços de sempre.
 */
const redirectsDoLayoutAnterior = [
  { source: "/", destination: "/v2", permanent: false },
  // O V1 juntava contas e usuários numa tela só; na V2 são telas separadas, e a de contas vem primeiro.
  { source: "/ajustes/configuracoes", destination: "/v2/ajustes/contas", permanent: false },
  { source: "/ajustes/:path*", destination: "/v2/ajustes/:path*", permanent: false },
  { source: "/indicadores/:path*", destination: "/v2/indicadores/:path*", permanent: false },
  // Rotas legadas que já eram redirects para o V1: vão direto à V2.
  { source: "/dashboard/settings", destination: "/v2/ajustes/contas", permanent: false },
  { source: "/dashboard/dados", destination: "/v2/ajustes/dados", permanent: false },
];

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Arquivamento da Central de Links: o single-file-cli roda como processo filho e o Chromium vem em
  // binários .br; nenhum dos dois pode ser empacotado, e os arquivos precisam ir junto da rota.
  serverExternalPackages: ["single-file-cli", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/central-de-links/arquivar": [
      "./node_modules/single-file-cli/**/*",
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
  // O Teste A/B saiu da Central de Links e foi para os Indicadores: os endereços antigos seguem valendo.
  async redirects() {
    return [
      { source: "/v2/central-de-links/testes", destination: "/v2/indicadores/testes-ab", permanent: true },
      { source: "/v2/central-de-links/testes/:id", destination: "/v2/indicadores/testes-ab/:id", permanent: true },
      ...redirectsDoLayoutAnterior,
    ];
  },
  experimental: {
    optimizePackageImports: ["recharts"],
  },
};

export default nextConfig;
