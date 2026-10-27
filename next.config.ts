import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
  experimental: {
    optimizePackageImports: ["recharts"],
  },
};

export default nextConfig;
