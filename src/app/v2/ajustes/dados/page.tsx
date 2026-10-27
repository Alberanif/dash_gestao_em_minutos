import type { Metadata } from "next";
import { DadosAjustes } from "@/components/v2/ajustes/dados/dados-ajustes";

export const metadata: Metadata = { title: "Dados e sincronização" };

export default function DadosAjustesPage() {
  return <DadosAjustes />;
}
