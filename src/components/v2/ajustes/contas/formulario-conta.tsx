"use client";

import { useState } from "react";
import type { Account, YouTubeCredentials } from "@/types/accounts";
import { Button, Campo, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Select, Selo } from "../../ui";
import { PLATAFORMAS, type Plataforma } from "./plataformas";

interface FormularioContaProps {
  /** Presente ao editar; ausente ao criar. */
  conta?: Account;
  /** Plataforma pré-selecionada ao criar (o V1 começava sempre em YouTube). */
  plataformaInicial?: Plataforma;
  onSalvar: () => void;
  onCancelar: () => void;
}

export function FormularioConta({ conta, plataformaInicial = "youtube", onSalvar, onCancelar }: FormularioContaProps) {
  const editando = !!conta;
  const [nome, setNome] = useState(conta?.name ?? "");
  const [plataforma, setPlataforma] = useState<Plataforma>(conta?.platform ?? plataformaInicial);

  // YouTube
  const ytCreds = editando && conta.platform === "youtube" ? (conta.credentials as YouTubeCredentials) : null;
  const [ytClientId, setYtClientId] = useState(ytCreds?.client_id ?? "");
  const [ytClientSecret, setYtClientSecret] = useState(ytCreds?.client_secret ?? "");
  const [ytHistoryStart, setYtHistoryStart] = useState(
    ytCreds?.history_start_date ?? new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString().slice(0, 10),
  );
  const [ytChannelId, setYtChannelId] = useState(ytCreds?.channel_id ?? "");

  // Instagram
  const [accessToken, setAccessToken] = useState(
    editando && conta.platform === "instagram" ? (conta.credentials as { access_token: string }).access_token : "",
  );
  const [userId, setUserId] = useState(
    editando && conta.platform === "instagram" ? (conta.credentials as { user_id: string }).user_id : "",
  );

  // Hotmart
  const [hmClientId, setHmClientId] = useState(
    editando && conta.platform === "hotmart" ? (conta.credentials as { client_id: string }).client_id : "",
  );
  const [hmClientSecret, setHmClientSecret] = useState(
    editando && conta.platform === "hotmart" ? (conta.credentials as { client_secret: string }).client_secret : "",
  );

  // Meta Ads
  const [metaAccessToken, setMetaAccessToken] = useState(
    editando && conta.platform === "meta-ads" ? (conta.credentials as { access_token: string }).access_token : "",
  );
  const [metaAdAccountId, setMetaAdAccountId] = useState(
    editando && conta.platform === "meta-ads" ? (conta.credentials as { ad_account_id: string }).ad_account_id : "",
  );

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function montarCredenciais() {
    if (plataforma === "youtube") {
      return { client_id: ytClientId, client_secret: ytClientSecret, history_start_date: ytHistoryStart, channel_id: ytChannelId };
    }
    if (plataforma === "instagram") return { access_token: accessToken, user_id: userId };
    if (plataforma === "meta-ads") return { access_token: metaAccessToken, ad_account_id: metaAdAccountId };
    return { client_id: hmClientId, client_secret: hmClientSecret };
  }

  async function enviar() {
    const url = editando ? `/api/accounts/${conta.id}` : "/api/accounts";
    const method = editando ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nome, platform: plataforma, credentials: montarCredenciais() }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Erro ao salvar");
    }
    return res;
  }

  // YouTube: salva a conta e segue para o OAuth do Google (navegação de página inteira).
  async function conectarYouTube(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const res = await enviar();
      const salvo = await res.json();
      const idSalvo = editando ? conta.id : salvo.id;
      // Rota de API (OAuth do Google): precisa de navegação de página inteira, não de router.push.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/api/auth/youtube/connect?account_id=${idSalvo}`;
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido");
      setSalvando(false);
    }
  }

  // Demais plataformas: salva e fecha.
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      await enviar();
      onSalvar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSalvando(false);
    }
  }

  const youtubeConectado = editando && conta.platform === "youtube" && !!ytCreds?.refresh_token;

  return (
    <Dialog open onOpenChange={(v) => !v && onCancelar()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogTitle className="text-lg font-bold">{editando ? "Editar conta" : "Nova conta"}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-v2-nevoa/65">
          {editando ? "Atualize o nome e as credenciais da conta." : "Informe o nome e as credenciais da plataforma."}
        </DialogDescription>

        <form onSubmit={plataforma === "youtube" ? conectarYouTube : salvar} className="mt-5 flex flex-col gap-4">
          <Campo rotulo="Nome da conta">
            {(p) => (
              <Input {...p} type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: IGT Principal" required />
            )}
          </Campo>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-v2-nevoa/70">
              Plataforma
            </span>
            <Select
              aria-label="Plataforma"
              value={plataforma}
              onValueChange={(v) => setPlataforma(v as Plataforma)}
              disabled={editando}
              opcoes={PLATAFORMAS.map((p) => ({ value: p.chave, label: p.rotulo }))}
            />
          </div>

          {plataforma === "youtube" && (
            <>
              {youtubeConectado && (
                <Selo tom="ok" className="h-auto w-fit max-w-full whitespace-normal py-1">
                  Conectado — canal: {ytCreds?.channel_id}
                </Selo>
              )}
              <Campo
                rotulo="Channel ID"
                ajuda="ID do canal YouTube (começa com UC). Encontre em: YouTube Studio → Configurações → Informações do canal."
              >
                {(p) => (
                  <Input {...p} type="text" value={ytChannelId} onChange={(e) => setYtChannelId(e.target.value)} placeholder="UCxxxxxxxxxxxxxxxxxxxxxxxx" required />
                )}
              </Campo>
              <Campo rotulo="Google Client ID">
                {(p) => (
                  <Input {...p} type="text" value={ytClientId} onChange={(e) => setYtClientId(e.target.value)} placeholder="123456789-abc....apps.googleusercontent.com" required />
                )}
              </Campo>
              <Campo rotulo="Google Client Secret">
                {(p) => (
                  <Input {...p} type="password" value={ytClientSecret} onChange={(e) => setYtClientSecret(e.target.value)} placeholder="••••••••" required />
                )}
              </Campo>
              <Campo rotulo="Data de início do histórico" ajuda="Define até onde o backfill vai buscar dados históricos.">
                {(p) => (
                  <Input {...p} type="date" value={ytHistoryStart} onChange={(e) => setYtHistoryStart(e.target.value)} required />
                )}
              </Campo>
            </>
          )}

          {plataforma === "instagram" && (
            <>
              <Campo rotulo="Access Token">
                {(p) => <Input {...p} type="text" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAx..." required />}
              </Campo>
              <Campo rotulo="User ID">
                {(p) => <Input {...p} type="text" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="1234567890" required />}
              </Campo>
            </>
          )}

          {plataforma === "meta-ads" && (
            <>
              <Campo rotulo="Access Token">
                {(p) => <Input {...p} type="text" value={metaAccessToken} onChange={(e) => setMetaAccessToken(e.target.value)} placeholder="EAAx..." required />}
              </Campo>
              <Campo rotulo="Ad Account ID" ajuda='Inclua o prefixo "act_" (ex: act_3689989500461)'>
                {(p) => <Input {...p} type="text" value={metaAdAccountId} onChange={(e) => setMetaAdAccountId(e.target.value)} placeholder="act_3689989500461" required />}
              </Campo>
            </>
          )}

          {plataforma === "hotmart" && (
            <>
              <Campo rotulo="Client ID">
                {(p) => <Input {...p} type="text" value={hmClientId} onChange={(e) => setHmClientId(e.target.value)} placeholder="Ex: a1b2c3d4-..." required />}
              </Campo>
              <Campo rotulo="Client Secret">
                {(p) => <Input {...p} type="password" value={hmClientSecret} onChange={(e) => setHmClientSecret(e.target.value)} placeholder="••••••••" required />}
              </Campo>
            </>
          )}

          {erro && (
            <p role="alert" className="m-0 text-sm text-v2-queda">
              {erro}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button variante="secundario" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando
                ? "Salvando…"
                : plataforma === "youtube"
                  ? youtubeConectado
                    ? "Reconectar com Google"
                    : "Salvar e conectar com Google"
                  : "Salvar conta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
