"use client";

import { useEffect } from "react";
import { Button } from "@/components/v2/ui/button";
import { Surface } from "@/components/v2/ui/surface";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("v2/eventos: erro inesperado", error);
  }, [error]);

  return (
    <Surface className="mt-2 max-w-xl" role="alert">
      <h2 className="text-lg font-semibold">Não foi possível abrir os eventos</h2>
      <p className="mt-2 text-sm text-v2-nevoa/70">
        Algo falhou ao montar a tela. Tente de novo; se continuar, avise quem cuida do painel.
      </p>
      <Button className="mt-4" onClick={() => retry()}>
        Tentar de novo
      </Button>
    </Surface>
  );
}
