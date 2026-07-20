import { redirect } from "next/navigation";

// Rota legada: as configurações moraram aqui antes do módulo Ajustes.
// Mantida apenas como redirect para não quebrar bookmarks e links antigos.
export default function SettingsPage() {
  redirect("/ajustes/configuracoes");
}
