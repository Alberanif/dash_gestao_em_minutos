"use client";

import { useState } from "react";
import { enderecoPublico } from "@/lib/central-de-links/endereco-publico";
import { slugDe } from "@/lib/central-de-links/slug";
import { TIPOS_DE_LINK, type LinkDaCentral, type TipoDeLink } from "@/lib/central-de-links/tipos";
import { Button, Campo, Confirmar, Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, Input, Select } from "../ui";
import { cx, foco } from "../ui/cx";

const NOVA_PASTA = "__nova__";

const OPCOES_TIPO = (Object.keys(TIPOS_DE_LINK) as TipoDeLink[]).map((t) => ({ value: t, label: TIPOS_DE_LINK[t] }));

function mensagem(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Não foi possível concluir a ação.";
}

/** Estado comum dos modais: envio em andamento e erro inline (sem alert). */
function useEnvio(onConcluir: () => void) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  async function enviar(acao: () => Promise<void>) {
    setErro("");
    setSalvando(true);
    try {
      await acao();
      onConcluir();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setSalvando(false);
    }
  }
  return { salvando, erro, enviar };
}

function Rodape({ salvando, rotulo, esquerda }: { salvando: boolean; rotulo: string; esquerda?: React.ReactNode }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3">
      {esquerda && <div className="mr-auto">{esquerda}</div>}
      <DialogClose asChild>
        <Button variante="secundario">Cancelar</Button>
      </DialogClose>
      <Button type="submit" disabled={salvando}>
        {salvando ? "Salvando…" : rotulo}
      </Button>
    </div>
  );
}

function Erro({ texto }: { texto: string }) {
  return (
    <p role="alert" className="mt-3 min-h-5 text-sm text-v2-queda">
      {texto}
    </p>
  );
}

/* -------------------------------------------------------------------------- link */

export type DadosDoLink = {
  id?: string;
  label: string;
  url: string;
  grupo: string;
  tipo: TipoDeLink;
  /** undefined = deixa o servidor escolher (link novo) ou manter o atual. */
  slug?: string;
  paginaAtiva: boolean;
  /** Arquivo .html escolhido agora; null = não mexe no arquivo. */
  arquivo: File | null;
  /** Só link novo: entra na fila de arquivamento automático (a cópia nasce privada). */
  arquivoAutomatico: boolean;
};

function tamanhoLegivel(n: number | null): string {
  if (!n) return "0 KB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function nomeDoArquivo(path: string): string {
  return path.split("/").pop() ?? path;
}

type DialogoLinkProps = {
  /** null = fechado; `{ link: null }` = novo link. */
  alvo: { link: LinkDaCentral | null; grupoInicial: string } | null;
  grupos: string[];
  onFechar: () => void;
  onSalvar: (dados: DadosDoLink) => Promise<void>;
  /** Remove o arquivo do link; o diálogo fecha em seguida. */
  onRemoverArquivo: (link: LinkDaCentral) => Promise<void>;
};

export function DialogoDeLink({ alvo, grupos, onFechar, onSalvar, onRemoverArquivo }: DialogoLinkProps) {
  return (
    <Dialog open={alvo !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        {alvo && <FormularioDeLink key={alvo.link?.id ?? "novo"} {...{ alvo, grupos, onFechar, onSalvar, onRemoverArquivo }} />}
      </DialogContent>
    </Dialog>
  );
}

function FormularioDeLink({ alvo, grupos, onFechar, onSalvar, onRemoverArquivo }: Omit<DialogoLinkProps, "alvo"> & { alvo: NonNullable<DialogoLinkProps["alvo"]> }) {
  const { link, grupoInicial } = alvo;
  const inicial = link?.grupo ?? grupoInicial;
  const existe = grupos.includes(inicial);
  const [label, setLabel] = useState(link?.label ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [escolha, setEscolha] = useState(existe ? inicial : inicial ? NOVA_PASTA : "");
  const [novoGrupo, setNovoGrupo] = useState(existe ? "" : inicial);
  const [tipo, setTipo] = useState<TipoDeLink>(link?.tipo ?? "cap");
  const [slug, setSlug] = useState(link?.slug ?? "");
  // Link novo: o apelido acompanha o nome até a pessoa mexer nele.
  const [slugMexido, setSlugMexido] = useState(link !== null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [paginaAtiva, setPaginaAtiva] = useState(link?.pagina_ativa ?? false);
  const [arquivoAutomatico, setArquivoAutomatico] = useState(true);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const { salvando, erro, enviar } = useEnvio(onFechar);

  const grupo = escolha === NOVA_PASTA ? novoGrupo.trim() : escolha;
  const slugAtual = (slugMexido ? slug : slugDe(label)).trim();
  const temArquivo = Boolean(link?.arquivo_path) || arquivo !== null;
  const ativa = temArquivo && paginaAtiva;
  const endereco =
    slugAtual || link?.id
      ? enderecoPublico(typeof window === "undefined" ? "" : window.location.origin, { id: link?.id ?? "", slug: slugAtual || null })
      : "";

  return (
    <>
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enviar(() =>
          onSalvar({
            id: link?.id,
            label: label.trim(),
            url: url.trim(),
            grupo,
            tipo,
            slug: link === null && !slugMexido ? undefined : slugAtual || undefined,
            paginaAtiva: ativa,
            arquivo,
            // Com arquivo enviado à mão não há o que capturar.
            arquivoAutomatico: link === null && arquivoAutomatico && arquivo === null,
          }),
        );
      }}
    >
      <DialogTitle className="text-lg font-bold">{link ? "Editar link" : "Novo link"}</DialogTitle>
      <DialogDescription className="mt-1 text-sm text-v2-nevoa/65">
        Nome, endereço, pasta e tipo da página.
      </DialogDescription>
      <div className="mt-4 flex flex-col gap-4">
        <Campo rotulo="Nome">
          {(a) => <Input {...a} value={label} onChange={(e) => setLabel(e.target.value)} autoComplete="off" required />}
        </Campo>
        <Campo rotulo="URL">
          {(a) => (
            <Input {...a} type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" required />
          )}
        </Campo>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-v2-nevoa/70">Pasta</span>
          <Select
            aria-label="Pasta"
            value={escolha || undefined}
            onValueChange={setEscolha}
            placeholder="Selecione uma pasta…"
            opcoes={[...grupos.map((g) => ({ value: g, label: g })), { value: NOVA_PASTA, label: "+ Nova pasta" }]}
          />
          {escolha === NOVA_PASTA && (
            <Input
              aria-label="Nome da nova pasta"
              placeholder="Nome da nova pasta"
              value={novoGrupo}
              onChange={(e) => setNovoGrupo(e.target.value)}
              autoComplete="off"
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-v2-nevoa/70">Tipo</span>
          <Select aria-label="Tipo" value={tipo} onValueChange={(v) => setTipo(v as TipoDeLink)} opcoes={OPCOES_TIPO} />
        </div>
        <Campo rotulo="Slug" ajuda={endereco ? `Endereço público: ${endereco}` : "Letras minúsculas, números e hífens."}>
          {(a) => (
            <Input
              {...a}
              value={slugAtual}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugMexido(true);
              }}
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Campo>
        <div className="flex flex-col gap-2">
          <Campo rotulo="Arquivo da página (.html)" ajuda="Até 50 MB.">
            {(a) => (
              <Input
                {...a}
                type="file"
                accept=".html,text/html"
                className="h-auto py-2"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
            )}
          </Campo>
          {link?.arquivo_path && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-v2-nevoa/70" data-testid="arquivo-atual">
              <span>
                Arquivo atual: {nomeDoArquivo(link.arquivo_path)} · {tamanhoLegivel(link.arquivo_tam)}
                {arquivo ? " (será substituído)" : ""}
              </span>
              <Button variante="secundario" className="h-8 px-3 text-v2-queda" onClick={() => setConfirmandoRemocao(true)}>
                Remover arquivo
              </Button>
            </div>
          )}
        </div>
        {link === null && (
          <label className="flex min-h-11 items-center gap-3 text-sm text-v2-nevoa">
            <input
              type="checkbox"
              checked={arquivoAutomatico}
              onChange={(e) => setArquivoAutomatico(e.target.checked)}
              className="h-4 w-4 accent-v2-azul-igt"
            />
            Arquivar esta página automaticamente
          </label>
        )}
        <div className="flex min-h-11 items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span id="pagina-publica-rotulo" className="text-sm font-medium text-v2-nevoa">
              Página pública ativa
            </span>
            <span className="text-xs text-v2-nevoa/60">
              {temArquivo ? "Qualquer pessoa com o endereço abre a cópia." : "Escolha um arquivo para poder ativar."}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={ativa}
            aria-labelledby="pagina-publica-rotulo"
            disabled={!temArquivo}
            onClick={() => setPaginaAtiva((v) => !v)}
            className={cx(
              "relative h-7 w-12 shrink-0 rounded-full p-0.5 ring-1 ring-inset ring-v2-azul-luz/25 before:absolute before:-inset-2 before:content-[''] disabled:pointer-events-none disabled:opacity-40",
              ativa ? "bg-v2-azul-igt" : "bg-v2-casco-alto",
              foco,
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                "block h-6 w-6 rounded-full bg-v2-nevoa shadow-v2-1 transition-transform duration-[120ms]",
                ativa ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </div>
      </div>
      <Erro texto={erro} />
      <Rodape salvando={salvando} rotulo="Salvar" />
    </form>
    <Confirmar
      aberto={confirmandoRemocao}
      onFechar={() => setConfirmandoRemocao(false)}
      onConfirmar={() => {
        setConfirmandoRemocao(false);
        if (link) void enviar(() => onRemoverArquivo(link));
      }}
      titulo="Remover arquivo"
      descricao={`A cópia de "${link?.label ?? ""}" será apagada e a página pública sai do ar.`}
      rotuloConfirmar="Remover"
    />
    </>
  );
}
