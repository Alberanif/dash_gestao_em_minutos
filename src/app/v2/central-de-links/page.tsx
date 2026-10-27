import type { Metadata } from "next";
import { TelaDeLinks } from "@/components/v2/central-de-links/tela-de-links";

export const metadata: Metadata = { title: "Central de links" };

export default function CentralDeLinksPage() {
  return <TelaDeLinks />;
}
