import type { Metadata } from "next";
import { KitDemoLazy } from "@/components/v2/kit/kit-lazy";

export const metadata: Metadata = { title: "Kit V2" };

// Página interna de validação visual dos primitivos (pasta %5Fkit para a URL ser /v2/_kit).
export default function KitPage() {
  return <KitDemoLazy />;
}
