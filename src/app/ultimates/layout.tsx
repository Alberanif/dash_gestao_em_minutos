import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dash Ultimates — IGT",
};

// Pinta o fundo escuro na viewport inteira (o container interno tem
// max-width) — mesmo padrão de src/app/indicadores/layout.tsx. O guard de
// papel continua em page.tsx.
export default function UltimatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main style={{ minHeight: "100vh", background: "#0d0f12" }}>{children}</main>;
}
