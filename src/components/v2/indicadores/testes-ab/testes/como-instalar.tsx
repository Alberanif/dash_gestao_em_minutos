"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../ui";

const EXEMPLO_FORM = '<form data-ab-form action="..." method="post">\n  ...\n</form>';

export function snippetExterno(origem: string): string {
  return `<script src="${origem}/t.js" async></script>`;
}

/** Bloco inline = o próprio t.js dentro de uma tag script, para nunca divergir do arquivo hospedado. */
export function snippetInline(origem: string, js: string): string {
  return `<script data-origem="${origem}">\n${js.trim()}\n</script>`;
}

function Codigo({ id, texto }: { id: string; texto: string }) {
  return (
    <pre id={id} className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-v2-sm bg-v2-abismo p-3 text-xs text-v2-nevoa/90">
      {texto}
    </pre>
  );
}

type Props = { aberto: boolean; onFechar: () => void };

export function ComoInstalar({ aberto, onFechar }: Props) {
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>{aberto && <Corpo />}</DialogContent>
    </Dialog>
  );
}

function Corpo() {
  const origem = typeof window === "undefined" ? "" : window.location.origin;
  const externo = snippetExterno(origem);
  const [inline, setInline] = useState("Carregando o bloco completo…");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/t.js", { cache: "no-store" });
        if (!r.ok) throw new Error(`t.js ${r.status}`);
        const js = await r.text();
        if (vivo) setInline(snippetInline(origem, js));
      } catch {
        if (vivo) setInline("Não consegui carregar o bloco completo. Tente de novo.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [origem]);

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso("Código copiado.");
    } catch {
      setAviso("Não consegui copiar. Selecione o código e use Ctrl+C.");
    }
  }

  return (
    <div>
      <DialogTitle className="text-lg font-bold">Como instalar</DialogTitle>
      <DialogDescription className="mt-1 text-sm text-v2-nevoa/65">Rastreamento nas páginas do teste.</DialogDescription>
      <div className="mt-4 flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1 text-sm text-v2-nevoa/80">
        <p role="note" className="m-0 rounded-v2-sm bg-v2-ponto/10 p-3 text-v2-nevoa">
          O endereço do snippet é o deste domínio ({origem}). Se o painel mudar de endereço, reinstale o snippet nas páginas.
        </p>
        <p className="m-0">
          O rastreador <b>não substitui</b> o formulário do ActiveCampaign nem altera a página: só observa e avisa a Central. Registra,
          sempre por visitante, a visita (<code>pageview</code>), o início do preenchimento (<code>form_inicio</code>) e a conversão
          (<code>lead</code>), quando o formulário é enviado e a validação da página não o barra.
        </p>
        <ol className="m-0 list-decimal pl-5">
          <li>Escolha uma das duas opções abaixo (as duas fazem o mesmo).</li>
          <li>
            Cole no HTML de cada página de captura do teste, logo antes de <code>&lt;/body&gt;</code>.
          </li>
          <li>Confira que o endereço cadastrado na Central é igual ao que o público acessa; se for diferente, a visita é descartada.</li>
          <li>Inicie o teste. A Central só conta visitas enquanto ele estiver ativo.</li>
        </ol>
        <h3 className="m-0 mt-2 text-sm font-bold text-v2-nevoa">Opção 1: arquivo hospedado (recomendada)</h3>
        <Codigo id="snippet-externo" texto={externo} />
        <div>
          <Button variante="secundario" onClick={() => void copiar(externo)}>
            Copiar opção 1
          </Button>
        </div>
        <h3 className="m-0 mt-2 text-sm font-bold text-v2-nevoa">Opção 2: bloco completo na página</h3>
        <p className="m-0">
          Use só se a página não aceitar script externo. Se o rastreador mudar, será preciso colar de novo em cada página.
        </p>
        <Codigo id="snippet-inline" texto={inline} />
        <div>
          <Button variante="secundario" onClick={() => void copiar(inline)}>
            Copiar opção 2
          </Button>
        </div>
        <h3 className="m-0 mt-2 text-sm font-bold text-v2-nevoa">Formulários que não são do ActiveCampaign</h3>
        <p className="m-0">
          Em qualquer outro formulário, acrescente <code>data-ab-form</code> na tag <code>&lt;form&gt;</code>:
        </p>
        <Codigo id="snippet-form" texto={EXEMPLO_FORM} />
        <div>
          <Button variante="secundario" onClick={() => void copiar(EXEMPLO_FORM)}>
            Copiar exemplo
          </Button>
        </div>
      </div>
      <p role="status" className="mt-3 min-h-5 text-sm text-v2-nevoa/75">
        {aviso}
      </p>
      <div className="mt-2 flex justify-end">
        <DialogClose asChild>
          <Button variante="secundario">Fechar</Button>
        </DialogClose>
      </div>
    </div>
  );
}
