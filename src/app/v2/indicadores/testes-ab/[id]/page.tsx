import type { Metadata } from "next";
import { TelaDeResultado } from "@/components/v2/indicadores/testes-ab/resultado/tela-de-resultado";

export const metadata: Metadata = { title: "Resultado do teste A/B" };

export default async function ResultadoDoTestePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TelaDeResultado testeId={id} />;
}
