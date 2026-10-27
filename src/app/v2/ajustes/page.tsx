import type { Metadata } from "next";
import "@/components/v2/menu-principal/menu-principal.css";
import { HubAjustes } from "@/components/v2/ajustes/hub";

export const metadata: Metadata = { title: "Ajustes" };

export default function AjustesV2() {
  return <HubAjustes />;
}
