"use client";

import { useEffect, useState } from "react";
import type { LinkDaCentral } from "@/lib/central-de-links/tipos";
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../ui";

/**
 * O HTML da cópia é de terceiros: o iframe NÃO leva `allow-same-origin`, então o script da cópia
 * roda em origem opaca e não alcança cookies, storage nem o DOM do painel.
 */
export const SANDBOX_DA_COPIA = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

type Props = {
  /** null = fechado. */
  link: LinkDaCentral | null;
  baixar: (arquivoPath: string) => Promise<string>;
  onFechar: () => void;
};

export function DialogoDeCopia({ link, baixar, onFechar }: Props) {
  return (
    <Dialog open={link !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="flex h-[min(46rem,calc(100vh-2rem))] w-[min(64rem,calc(100vw-2rem))] flex-col">
        {link && <Corpo key={link.id} link={link} baixar={baixar} />}
      </DialogContent>
    </Dialog>
  );
}

function Corpo({ link, baixar }: { link: LinkDaCentral; baixar: Props["baixar"] }) {
  const [html, setHtml] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    baixar(link.arquivo_path as string)
      .then((t) => vivo && setHtml(t))
      .catch((e) => vivo && setErro(e instanceof Error && e.message ? e.message : "Não foi possível abrir a cópia."));
    return () => {
      vivo = false;
    };
  }, [link.arquivo_path, baixar]);

  return (
    <>
      <DialogTitle className="text-lg font-bold">Cópia de {link.label}</DialogTitle>
      <DialogDescription className="mt-1 text-sm text-v2-nevoa/65">
        Página arquivada, como foi salva. Os scripts dela rodam isolados do painel.
      </DialogDescription>
      <div className="mt-4 min-h-0 flex-1">
        {erro ? (
          <p role="alert" className="text-sm text-v2-queda">
            {erro}
          </p>
        ) : html === null ? (
          <p role="status" className="text-sm text-v2-nevoa/65">
            Carregando cópia…
          </p>
        ) : (
          <iframe
            title={`Cópia de ${link.label}`}
            srcDoc={html}
            sandbox={SANDBOX_DA_COPIA}
            className="h-full w-full rounded-v2-sm bg-white"
          />
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <DialogClose asChild>
          <Button variante="secundario">Fechar</Button>
        </DialogClose>
      </div>
    </>
  );
}
