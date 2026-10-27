"use client";

import { useState } from "react";
import type { UserRole } from "@/types/auth";
import {
  Button,
  Campo,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Select,
} from "../../ui";
import { nomeDe, OPCOES_FUNCAO, type Usuario } from "./tipos";

function Erro({ mensagem }: { mensagem: string }) {
  if (!mensagem) return null;
  return (
    <p role="alert" className="m-0 text-sm text-v2-queda">
      {mensagem}
    </p>
  );
}

function SeletorDeFuncao({
  valor,
  onChange,
  rotulo,
}: {
  valor: UserRole;
  onChange: (v: UserRole) => void;
  rotulo: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-v2-nevoa/70">{rotulo}</span>
      <Select
        aria-label={rotulo}
        value={valor}
        onValueChange={(v) => onChange(v as UserRole)}
        opcoes={OPCOES_FUNCAO}
      />
    </div>
  );
}

/** Novo usuário: e-mail, senha (mínimo 6) e função. Os campos são zerados ao reabrir. */
export function DialogoNovoUsuario({
  aberto,
  onFechar,
  onCriar,
  salvando,
  erro,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriar: (dados: { email: string; password: string; role: UserRole }) => void;
  salvando: boolean;
  erro: string;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>{aberto && <FormularioNovo onCriar={onCriar} salvando={salvando} erro={erro} />}</DialogContent>
    </Dialog>
  );
}

function FormularioNovo({
  onCriar,
  salvando,
  erro,
}: {
  onCriar: (dados: { email: string; password: string; role: UserRole }) => void;
  salvando: boolean;
  erro: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("comum");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCriar({ email, password, role });
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <DialogTitle className="text-lg font-bold">Novo usuário</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-v2-nevoa/70">
          A pessoa entra com este e-mail e esta senha.
        </DialogDescription>
      </div>
      <Campo rotulo="E-mail">
        {(p) => (
          <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@exemplo.com" required />
        )}
      </Campo>
      <Campo rotulo="Senha">
        {(p) => (
          <Input
            {...p}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
            minLength={6}
          />
        )}
      </Campo>
      <SeletorDeFuncao rotulo="Função" valor={role} onChange={setRole} />
      <Erro mensagem={erro} />
      <div className="flex justify-end gap-3">
        <DialogClose asChild>
          <Button variante="secundario">Cancelar</Button>
        </DialogClose>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Criando…" : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}

/** Aprovar solicitação: escolhe a função (padrão Comum) e confirma. */
export function DialogoAprovar({
  usuario,
  onFechar,
  onAprovar,
  salvando,
  erro,
}: {
  usuario: Usuario | null;
  onFechar: () => void;
  onAprovar: (u: Usuario, funcao: UserRole) => void;
  salvando: boolean;
  erro: string;
}) {
  return (
    <Dialog open={!!usuario} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        {usuario && <CorpoEscolhaDeFuncao
          key={usuario.id}
          titulo="Aprovar solicitação"
          descricao={`Escolha a função de ${nomeDe(usuario)} no painel.`}
          funcaoInicial="comum"
          rotuloAcao="Aprovar"
          rotuloCarregando="Aprovando…"
          salvando={salvando}
          erro={erro}
          onAcao={(f) => onAprovar(usuario, f)}
        />}
      </DialogContent>
    </Dialog>
  );
}

/** Alterar função: começa na função atual da pessoa. */
export function DialogoAlterarFuncao({
  usuario,
  onFechar,
  onAlterar,
  salvando,
  erro,
}: {
  usuario: Usuario | null;
  onFechar: () => void;
  onAlterar: (u: Usuario, funcao: UserRole) => void;
  salvando: boolean;
  erro: string;
}) {
  return (
    <Dialog open={!!usuario} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        {usuario && <CorpoEscolhaDeFuncao
          key={usuario.id}
          titulo="Alterar função"
          descricao={`Defina a nova função de ${nomeDe(usuario)}.`}
          funcaoInicial={usuario.role as UserRole}
          rotuloAcao="Alterar função"
          rotuloCarregando="Alterando…"
          salvando={salvando}
          erro={erro}
          onAcao={(f) => onAlterar(usuario, f)}
        />}
      </DialogContent>
    </Dialog>
  );
}

function CorpoEscolhaDeFuncao({
  titulo,
  descricao,
  funcaoInicial,
  rotuloAcao,
  rotuloCarregando,
  salvando,
  erro,
  onAcao,
}: {
  titulo: string;
  descricao: string;
  funcaoInicial: UserRole;
  rotuloAcao: string;
  rotuloCarregando: string;
  salvando: boolean;
  erro: string;
  onAcao: (f: UserRole) => void;
}) {
  const [funcao, setFuncao] = useState<UserRole>(funcaoInicial);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle className="text-lg font-bold">{titulo}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-v2-nevoa/70">{descricao}</DialogDescription>
      </div>
      <SeletorDeFuncao rotulo="Função" valor={funcao} onChange={setFuncao} />
      <Erro mensagem={erro} />
      <div className="flex justify-end gap-3">
        <DialogClose asChild>
          <Button variante="secundario">Cancelar</Button>
        </DialogClose>
        <Button onClick={() => onAcao(funcao)} disabled={salvando}>
          {salvando ? rotuloCarregando : rotuloAcao}
        </Button>
      </div>
    </div>
  );
}
