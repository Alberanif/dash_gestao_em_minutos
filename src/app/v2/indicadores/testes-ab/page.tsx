import type { Metadata } from "next";
import { BotaoVoltarIcone } from "@/components/v2/ui/voltar-icone";
import { TelaDeTestes } from "@/components/v2/indicadores/testes-ab/testes/tela-de-testes";

export const metadata: Metadata = { title: "Testes A/B" };

export default function TestesAbPage() {
  return (
    <>
      <BotaoVoltarIcone href="/v2/indicadores" rotulo="Voltar aos indicadores" />
      <TelaDeTestes />
    </>
  );
}
