"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { lerTudo } from "@/lib/central-de-links/dados";
import { podeEditar } from "@/lib/central-de-links/papel";
import type { LinkDaCentral } from "@/lib/central-de-links/tipos";
import { Button, Confirmar, Selo, Surface, type TomDoSelo } from "../../../ui";
import { usePapelCentral } from "@/components/v2/central-de-links/papel-context";
import { chamarTestes, type EstadoDoTeste, type TesteAb } from "./api-testes";
import { ComoInstalar } from "./como-instalar";
import { DialogoDeTeste, type DadosDoTeste } from "./dialogo-de-teste";
import { DialogoEncerrar } from "./dialogo-encerrar";

const ESTADOS: Record<EstadoDoTeste, { rotulo: string; tom: TomDoSelo }> = {
  rascunho: { rotulo: "Rascunho", tom: "neutro" },
  ativo: { rotulo: "Ativo", tom: "ok" },
  encerrado: { rotulo: "Encerrado", tom: "info" },
};

function data(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function mensagem(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Não foi possível concluir a ação.";
}

function textoDoVencedor(t: TesteAb): string {
  if (t.status !== "encerrado") return "";
  const v = (t.ab_variantes ?? []).find((x) => x.id === t.vencedor_variante);
  return v ? `Vencedor: variante ${v.rotulo}` : "Sem diferença";
}

type Carga = "carregando" | "pronto" | "erro";

export function TelaDeTestes() {
  const papel = usePapelCentral();
  const admin = podeEditar(papel);

  const [carga, setCarga] = useState<Carga>("carregando");
  const [erroDeCarga, setErroDeCarga] = useState("");
  const [testes, setTestes] = useState<TesteAb[]>([]);
  const [paginas, setPaginas] = useState<LinkDaCentral[]>([]);
  const [erroDeAcao, setErroDeAcao] = useState("");
  const [aviso, setAviso] = useState("");

  const [editando, setEditando] = useState<{ teste: TesteAb | null } | null>(null);
  const [encerrando, setEncerrando] = useState<TesteAb | null>(null);
  const [excluindo, setExcluindo] = useState<TesteAb | null>(null);
  const [instalando, setInstalando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await chamarTestes<{ testes: TesteAb[] }>({ acao: "listar" });
      setTestes(r.testes ?? []);
      setCarga("pronto");
    } catch (e) {
      setErroDeCarga(mensagem(e));
      setCarga("erro");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // As páginas candidatas só importam a quem cria/edita.
  useEffect(() => {
    if (!admin) return;
    let vivo = true;
    (async () => {
      try {
        const { links } = await lerTudo(createSupabaseBrowserClient());
        if (vivo) setPaginas(links.filter((l) => l.tipo === "cap" && !l.deleted));
      } catch {
        if (vivo) setErroDeAcao("Não consegui carregar as páginas de captura.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [admin]);

  async function executar(corpo: { acao: string } & Record<string, unknown>, ok: string) {
    setErroDeAcao("");
    setAviso("");
    setOcupado(true);
    try {
      await chamarTestes(corpo);
      setAviso(ok);
      await carregar();
    } catch (e) {
      setErroDeAcao(mensagem(e));
    } finally {
      setOcupado(false);
    }
  }

  async function salvar(d: DadosDoTeste) {
    // Erros da API sobem para o modal, que os mostra inline.
    await chamarTestes(d.id ? { acao: "editar", id: d.id, nome: d.nome, variantes: d.variantes } : { acao: "criar", nome: d.nome, variantes: d.variantes });
    setAviso(d.id ? "Teste atualizado." : "Teste criado.");
    await carregar();
  }

  async function encerrar(t: TesteAb, vencedor: string, anotacao: string) {
    await chamarTestes({ acao: "encerrar", id: t.id, vencedor_variante: vencedor || null, anotacao });
    setAviso("Teste encerrado.");
    await carregar();
  }

  const ordenados = testes;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-bold text-v2-nevoa">Testes A/B</h1>
          <p className="m-0 mt-1 text-sm text-v2-nevoa/65">Compare páginas de captura e acompanhe qual converte mais.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variante="secundario" onClick={() => setInstalando(true)}>
            Como instalar
          </Button>
          {admin && <Button onClick={() => setEditando({ teste: null })}>Novo teste</Button>}
        </div>
      </div>

      {aviso && (
        <p role="status" className="m-0 text-sm text-v2-alta">
          {aviso}
        </p>
      )}
      {erroDeAcao && (
        <p role="alert" className="m-0 text-sm text-v2-queda">
          {erroDeAcao}
        </p>
      )}

      {carga === "carregando" && <p className="m-0 text-sm text-v2-nevoa/65">Carregando testes…</p>}
      {carga === "erro" && (
        <Surface>
          <p role="alert" className="m-0 text-sm text-v2-queda">
            {erroDeCarga}
          </p>
          <Button variante="secundario" className="mt-3" onClick={() => void carregar()}>
            Tentar de novo
          </Button>
        </Surface>
      )}
      {carga === "pronto" && ordenados.length === 0 && (
        <Surface>
          <p className="m-0 text-sm text-v2-nevoa/75">Nenhum teste criado ainda.</p>
        </Surface>
      )}

      {carga === "pronto" &&
        ordenados.map((t) => {
          const estado = ESTADOS[t.status] ?? ESTADOS.rascunho;
          const variantes = t.ab_variantes ?? [];
          const vencedor = textoDoVencedor(t);
          return (
            <Surface key={t.id} className="flex flex-col gap-3" data-testid="teste">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="m-0 text-base font-bold text-v2-nevoa">{t.nome}</h2>
                <Selo tom={estado.tom}>{estado.rotulo}</Selo>
                {vencedor && <span className="text-sm text-v2-nevoa/80">{vencedor}</span>}
              </div>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-v2-nevoa/80">
                {variantes.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2">
                    <b className="text-v2-nevoa">{v.rotulo}</b>
                    {v.controle && <Selo tom="info">Controle</Selo>}
                    <span>{v.central_links?.label ?? "Página removida"}</span>
                  </li>
                ))}
              </ul>
              <p className="m-0 text-xs text-v2-nevoa/60">
                Criado em {data(t.created_at)}
                {t.iniciado_em ? ` · Iniciado em ${data(t.iniciado_em)}` : ""}
                {t.encerrado_em ? ` · Encerrado em ${data(t.encerrado_em)}` : ""}
              </p>
              {t.anotacao && <p className="m-0 text-sm text-v2-nevoa/75">{t.anotacao}</p>}
              <div className="flex flex-wrap gap-2">
                {t.status !== "rascunho" && (
                  <Link
                    href={`/v2/indicadores/testes-ab/${t.id}`}
                    className="inline-flex h-10 items-center rounded-v2-sm bg-v2-casco-alto px-4 text-sm font-medium text-v2-nevoa shadow-v2-1"
                  >
                    Ver resultado
                  </Link>
                )}
                {admin && t.status === "rascunho" && (
                  <>
                    <Button variante="secundario" disabled={ocupado} onClick={() => setEditando({ teste: t })}>
                      Editar
                    </Button>
                    <Button disabled={ocupado} onClick={() => void executar({ acao: "iniciar", id: t.id }, "Teste iniciado.")}>
                      Iniciar
                    </Button>
                  </>
                )}
                {admin && t.status === "ativo" && (
                  <Button disabled={ocupado} onClick={() => setEncerrando(t)}>
                    Encerrar
                  </Button>
                )}
                {admin && t.status !== "ativo" && (
                  <Button variante="secundario" className="text-v2-queda" disabled={ocupado} onClick={() => setExcluindo(t)}>
                    Excluir
                  </Button>
                )}
              </div>
            </Surface>
          );
        })}

      <DialogoDeTeste alvo={editando} paginas={paginas} onFechar={() => setEditando(null)} onSalvar={salvar} />
      <DialogoEncerrar teste={encerrando} onFechar={() => setEncerrando(null)} onEncerrar={encerrar} />
      <Confirmar
        aberto={excluindo !== null}
        onFechar={() => setExcluindo(null)}
        titulo="Excluir teste"
        descricao={
          excluindo?.status === "encerrado"
            ? `Excluir "${excluindo.nome}" apaga todo o histórico dele. Essa ação não pode ser desfeita.`
            : `O teste "${excluindo?.nome ?? ""}" será excluído.`
        }
        rotuloConfirmar="Excluir"
        carregando={ocupado}
        onConfirmar={() => {
          const t = excluindo;
          setExcluindo(null);
          if (t) void executar({ acao: "excluir", id: t.id, confirmar: t.status === "encerrado" }, "Teste excluído.");
        }}
      />
      <ComoInstalar aberto={instalando} onFechar={() => setInstalando(false)} />
    </div>
  );
}
