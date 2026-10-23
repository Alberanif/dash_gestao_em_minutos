import { redirect } from "next/navigation";

// O Indicadores abre no seletor de eventos.
export default function V2Home() {
  redirect("/v2/indicadores/eventos");
}
