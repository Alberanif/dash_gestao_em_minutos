"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { Button } from "../../ui/button";
import { cx } from "../../ui/cx";
import type { PropsAssistente } from "./estado";

// O assistente só é baixado na primeira abertura: a lista de eventos não paga o peso dele.
const AssistenteNovoEvento = dynamic<PropsAssistente>(() => import("./assistente").then((m) => m.AssistenteNovoEvento), {
  ssr: false,
});

type Props = {
  accountId: string;
  /** "cabecalho": ao lado da busca; "vazio": dentro do estado vazio. */
  variante?: "cabecalho" | "vazio";
};

export function BotaoNovoEvento({ accountId, variante = "cabecalho" }: Props) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);

  function fechar() {
    setAberto(false);
    // O foco volta ao botão depois que o diálogo sai da tela.
    requestAnimationFrame(() => botao.current?.focus());
  }

  return (
    <>
      <Button
        ref={botao}
        variante="primario"
        aria-haspopup="dialog"
        onClick={() => setAberto(true)}
        className={cx("min-h-11 shrink-0", variante === "cabecalho" ? "w-full @md:w-auto" : "mt-4")}
      >
        Novo evento
      </Button>
      {aberto && <AssistenteNovoEvento accountId={accountId} onFechar={fechar} />}
    </>
  );
}
