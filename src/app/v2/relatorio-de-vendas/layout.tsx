import type { Metadata } from "next";
import "@/components/v2/evento/voltar.css";
import { BotaoVoltarAoMenu } from "@/components/v2/central-de-links/voltar-ao-menu";

export const metadata: Metadata = { title: "Relatório de vendas" };

export default function RelatorioDeVendasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 py-6">
      <BotaoVoltarAoMenu />
      {children}
    </div>
  );
}
