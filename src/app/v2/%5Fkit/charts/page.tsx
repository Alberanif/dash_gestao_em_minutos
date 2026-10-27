import type { Metadata } from "next";
import { ChartsDemoLazy } from "@/components/v2/kit/kit-lazy";

export const metadata: Metadata = { title: "Gráficos V2" };

// Pasta %5Fkit para a URL ser /v2/_kit/charts (pasta _kit seria privada no App Router).
export default function ChartsKitPage() {
  return <ChartsDemoLazy />;
}
