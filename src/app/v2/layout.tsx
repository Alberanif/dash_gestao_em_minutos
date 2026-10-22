import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "@/components/v2/tokens.css";
import "@/components/v2/ui/ui.css";
import { MotionProvider } from "@/components/v2/motion";
import { V2Root } from "@/components/v2/ui/v2-root";
import { v2AccessRedirect } from "./access";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "IGT",
};

export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const destino = v2AccessRedirect(user);
  if (destino) redirect(destino);

  return (
    <V2Root className={`v2 ${manrope.variable}`}>
      <MotionProvider>{children}</MotionProvider>
    </V2Root>
  );
}
