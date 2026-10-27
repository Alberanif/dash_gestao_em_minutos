"use client";

import { usePathname } from "next/navigation";

/**
 * Entrada animada da página na troca de rota: opacity e translateY, em CSS (`v2-entra`).
 * Só entra (sem saída): no App Router o conteúdo da rota anterior já saiu quando a nova renderiza.
 * Fica fora do Motion de propósito: é o único movimento do shell e o JS do Motion pesa no orçamento.
 * Com prefers-reduced-motion o `ui.css` desliga a animação.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="v2-entra">
      {children}
    </div>
  );
}
