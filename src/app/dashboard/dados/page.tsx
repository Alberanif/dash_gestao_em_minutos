import { redirect } from "next/navigation";

// Rota legada: a tela de dados/sincronização morou aqui antes do módulo
// Ajustes. Mantida apenas como redirect para não quebrar bookmarks.
export default function DadosPage() {
  redirect("/ajustes/dados");
}
