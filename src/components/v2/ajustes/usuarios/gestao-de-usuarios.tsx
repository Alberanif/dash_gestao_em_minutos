"use client";

import { useCallback, useEffect, useState } from "react";
import { podeEditar, type PapelCentral } from "@/lib/central-de-links/papel";
import type { UserRole } from "@/types/auth";
import { Button, Confirmar, Surface } from "../../ui";
import { DialogoAlterarFuncao, DialogoAprovar, DialogoNovoUsuario } from "./dialogos";
import { ListaDeUsuarios } from "./lista-de-usuarios";
import { SolicitacoesPendentes } from "./solicitacoes-pendentes";
import { nomeDe, type Usuario } from "./tipos";

type Carga = "carregando" | "pronto" | "erro";

async function mensagemDaApi(res: Response, padrao: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || padrao;
  } catch {
    return padrao;
  }
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function GestaoDeUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carga, setCarga] = useState<Carga>("carregando");
  const [usuarioAtualId, setUsuarioAtualId] = useState<string | null>(null);

  const [criando, setCriando] = useState(false);
  const [aprovando, setAprovando] = useState<Usuario | null>(null);
  const [alterando, setAlterando] = useState<Usuario | null>(null);
  const [excluindo, setExcluindo] = useState<Usuario | null>(null);
  const [rejeitando, setRejeitando] = useState<Usuario | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [erroDialogo, setErroDialogo] = useState("");
  const [erroPagina, setErroPagina] = useState("");
  const [acessoSalvandoId, setAcessoSalvandoId] = useState<string | null>(null);
  const [erroAcesso, setErroAcesso] = useState<{ usuarioId: string; mensagem: string } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("falha");
      setUsuarios(await res.json());
      setCarga("pronto");
    } catch {
      setCarga("erro");
    }
  }, []);

  useEffect(() => {
    async function descobrirUsuarioAtual() {
      try {
        const res = await fetch("/api/auth/user");
        if (res.ok) {
          const data = await res.json();
          setUsuarioAtualId(data.id);
        }
      } catch {
        // sem o id atual a tela só deixa de esconder as ações da própria conta; a API segue recusando.
      }
    }
    void descobrirUsuarioAtual();
  }, []);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("falha"))))
      .then((dados: Usuario[]) => {
        setUsuarios(dados);
        setCarga("pronto");
      })
      .catch(() => setCarga("erro"));
  }, []);

  function fecharDialogos() {
    setCriando(false);
    setAprovando(null);
    setAlterando(null);
    setErroDialogo("");
  }

  function abrir(abrirFn: () => void) {
    setErroDialogo("");
    setErroPagina("");
    abrirFn();
  }

  async function criar(dados: { email: string; password: string; role: UserRole }) {
    setSalvando(true);
    setErroDialogo("");
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(dados) });
      if (!res.ok) {
        setErroDialogo(await mensagemDaApi(res, "Erro ao criar usuário"));
      } else {
        setCriando(false);
        await carregar();
      }
    } catch {
      setErroDialogo("Não foi possível falar com o servidor. Verifique a conexão e tente de novo.");
    }
    setSalvando(false);
  }

  /** Aprovar e alterar função são o mesmo PATCH; só mudam a origem e a mensagem de erro. */
  async function trocarFuncao(u: Usuario, funcao: UserRole, padraoErro: string, aoConcluir: () => void) {
    setSalvando(true);
    setErroDialogo("");
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ role: funcao }),
      });
      if (!res.ok) {
        setErroDialogo(await mensagemDaApi(res, padraoErro));
      } else {
        aoConcluir();
        await carregar();
      }
    } catch {
      setErroDialogo("Não foi possível falar com o servidor. Verifique a conexão e tente de novo.");
    }
    setSalvando(false);
  }

  /** Excluir e rejeitar são o mesmo DELETE. */
  async function remover(u: Usuario, aoConcluir: () => void) {
    setSalvando(true);
    setErroPagina("");
    try {
      const res = await fetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        setErroPagina(await mensagemDaApi(res, `Não foi possível remover ${nomeDe(u)}. Tente de novo.`));
      } else {
        await carregar();
      }
    } catch {
      setErroPagina("Não foi possível falar com o servidor. Verifique a conexão e tente de novo.");
    }
    aoConcluir();
    setSalvando(false);
  }

  async function alterarAcesso(u: Usuario, papel: PapelCentral | null) {
    setAcessoSalvandoId(u.id);
    setErroAcesso(null);
    try {
      const res = await fetch("/api/central-de-links/acesso", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ userId: u.id, centralRole: papel }),
      });
      if (!res.ok) {
        setErroAcesso({ usuarioId: u.id, mensagem: await mensagemDaApi(res, "Não foi possível alterar o acesso à Central.") });
      } else {
        await carregar();
      }
    } catch {
      setErroAcesso({
        usuarioId: u.id,
        mensagem: "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
      });
    }
    setAcessoSalvandoId(null);
  }

  // O próprio GET de usuários traz o central_role de quem está logado.
  const papelDoLogado = usuarios.find((u) => u.id === usuarioAtualId)?.central_role ?? null;
  const pendentes = usuarios.filter((u) => u.role === "pendente");
  const ativos = usuarios.filter((u) => u.role !== "pendente");

  return (
    <div className="flex flex-col gap-6">
      <div className="v2-entra flex justify-end" style={{ "--i": 0 } as React.CSSProperties}>
        <Button onClick={() => abrir(() => setCriando(true))}>Novo usuário</Button>
      </div>

      {erroPagina && (
        <p role="alert" className="m-0 rounded-v2-sm bg-v2-queda/15 px-4 py-3 text-sm text-v2-queda">
          {erroPagina}
        </p>
      )}

      {carga === "carregando" && (
        <Surface role="status" className="text-sm text-v2-nevoa/70">
          Carregando usuários…
        </Surface>
      )}

      {carga === "erro" && (
        <Surface role="alert" className="flex flex-col items-start gap-3">
          <p className="m-0 text-sm text-v2-queda">Não foi possível carregar os usuários.</p>
          <p className="m-0 text-sm text-v2-nevoa/70">Verifique a conexão e tente de novo.</p>
          <Button variante="secundario" onClick={() => void carregar()}>
            Tentar de novo
          </Button>
        </Surface>
      )}

      {carga === "pronto" && (
        <>
          <SolicitacoesPendentes
            pendentes={pendentes}
            onAprovar={(u) => abrir(() => setAprovando(u))}
            onRejeitar={(u) => abrir(() => setRejeitando(u))}
          />
          {ativos.length === 0 ? (
            <Surface className="text-sm text-v2-nevoa/70">
              Nenhum usuário com acesso ainda. Use “Novo usuário” para convidar a primeira pessoa.
            </Surface>
          ) : (
            <ListaDeUsuarios
              usuarios={ativos}
              usuarioAtualId={usuarioAtualId}
              onAlterarFuncao={(u) => abrir(() => setAlterando(u))}
              onExcluir={(u) => abrir(() => setExcluindo(u))}
              podeGerirCentral={podeEditar(papelDoLogado)}
              onAlterarAcesso={(u, papel) => void alterarAcesso(u, papel)}
              acessoSalvandoId={acessoSalvandoId}
              erroAcesso={erroAcesso}
            />
          )}
        </>
      )}

      <DialogoNovoUsuario aberto={criando} onFechar={fecharDialogos} onCriar={criar} salvando={salvando} erro={erroDialogo} />
      <DialogoAprovar
        usuario={aprovando}
        onFechar={fecharDialogos}
        onAprovar={(u, f) => trocarFuncao(u, f, "Erro ao aprovar solicitação", () => setAprovando(null))}
        salvando={salvando}
        erro={erroDialogo}
      />
      <DialogoAlterarFuncao
        usuario={alterando}
        onFechar={fecharDialogos}
        onAlterar={(u, f) => trocarFuncao(u, f, "Erro ao alterar função", () => setAlterando(null))}
        salvando={salvando}
        erro={erroDialogo}
      />

      <Confirmar
        aberto={!!excluindo}
        onFechar={() => setExcluindo(null)}
        onConfirmar={() => excluindo && void remover(excluindo, () => setExcluindo(null))}
        titulo={`Excluir o acesso de ${excluindo ? excluindo.email : ""}?`}
        descricao="A conta é removida e a pessoa deixa de entrar no painel. Esta ação não pode ser desfeita."
        rotuloConfirmar="Excluir acesso"
        carregando={salvando}
      />
      <Confirmar
        aberto={!!rejeitando}
        onFechar={() => setRejeitando(null)}
        onConfirmar={() => rejeitando && void remover(rejeitando, () => setRejeitando(null))}
        titulo={`Rejeitar a solicitação de ${rejeitando ? nomeDe(rejeitando) : ""}?`}
        descricao="A solicitação é removida e o e-mail fica livre para um novo cadastro."
        rotuloConfirmar="Rejeitar solicitação"
        carregando={salvando}
      />
    </div>
  );
}
