// src/components/settings/account-form.tsx
"use client";

import { useState } from "react";
import type { Account, YouTubeCredentials } from "@/types/accounts";

interface AccountFormProps {
  account?: Account;
  onSave: () => void;
  onCancel: () => void;
}

export function AccountForm({ account, onSave, onCancel }: AccountFormProps) {
  const isEditing = !!account;
  const [name, setName] = useState(account?.name ?? "");
  const [platform, setPlatform] = useState<"youtube" | "instagram" | "hotmart" | "meta-ads">(
    account?.platform ?? "youtube"
  );

  // YouTube OAuth fields
  const ytCreds = isEditing && account.platform === "youtube"
    ? (account.credentials as YouTubeCredentials)
    : null;
  const [ytClientId, setYtClientId] = useState(ytCreds?.client_id ?? "");
  const [ytClientSecret, setYtClientSecret] = useState(ytCreds?.client_secret ?? "");
  const [ytHistoryStart, setYtHistoryStart] = useState(
    ytCreds?.history_start_date ?? new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString().slice(0, 10)
  );
  const [ytChannelId, setYtChannelId] = useState(ytCreds?.channel_id ?? "");

  // Instagram fields
  const [accessToken, setAccessToken] = useState(
    isEditing && account.platform === "instagram"
      ? (account.credentials as { access_token: string }).access_token
      : ""
  );
  const [userId, setUserId] = useState(
    isEditing && account.platform === "instagram"
      ? (account.credentials as { user_id: string }).user_id
      : ""
  );

  // Hotmart fields
  const [hmClientId, setHmClientId] = useState(
    isEditing && account.platform === "hotmart"
      ? (account.credentials as { client_id: string }).client_id
      : ""
  );
  const [hmClientSecret, setHmClientSecret] = useState(
    isEditing && account.platform === "hotmart"
      ? (account.credentials as { client_secret: string }).client_secret
      : ""
  );

  // Meta Ads fields
  const [metaAccessToken, setMetaAccessToken] = useState(
    isEditing && account.platform === "meta-ads"
      ? (account.credentials as { access_token: string }).access_token
      : ""
  );
  const [metaAdAccountId, setMetaAdAccountId] = useState(
    isEditing && account.platform === "meta-ads"
      ? (account.credentials as { ad_account_id: string }).ad_account_id
      : ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function buildCredentials() {
    if (platform === "youtube") {
      return { client_id: ytClientId, client_secret: ytClientSecret, history_start_date: ytHistoryStart, channel_id: ytChannelId };
    }
    if (platform === "instagram") {
      return { access_token: accessToken, user_id: userId };
    }
    if (platform === "meta-ads") {
      return { access_token: metaAccessToken, ad_account_id: metaAdAccountId };
    }
    return { client_id: hmClientId, client_secret: hmClientSecret };
  }

  // Save account and redirect to Google OAuth
  async function handleYouTubeConnect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = isEditing ? `/api/accounts/${account.id}` : "/api/accounts";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, platform, credentials: buildCredentials() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar");
      }

      const saved = await res.json();
      const savedId = isEditing ? account.id : saved.id;

      // Redirect to OAuth flow (full page navigation)
      window.location.href = `/api/auth/youtube/connect?account_id=${savedId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setSaving(false);
    }
  }

  // Save account normally (Instagram/Hotmart)
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = isEditing ? `/api/accounts/${account.id}` : "/api/accounts";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, platform, credentials: buildCredentials() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar");
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  const isYouTubeConnected =
    isEditing && account.platform === "youtube" && !!ytCreds?.refresh_token;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="w-full max-w-md"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
          boxShadow: "var(--shadow-md)",
        }}
      >
        <h3 className="mb-4 text-lg font-semibold">
          {isEditing ? "Editar conta" : "Nova conta"}
        </h3>

        <form
          onSubmit={platform === "youtube" ? handleYouTubeConnect : handleSave}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Nome da conta
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: IGT Principal"
              required
              className="field-control"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Plataforma
            </label>
            <select
              value={platform}
              onChange={(e) =>
                setPlatform(e.target.value as "youtube" | "instagram" | "hotmart" | "meta-ads")
              }
              disabled={isEditing}
              className="field-control"
            >
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="meta-ads">Meta Ads</option>
              <option value="hotmart">Hotmart</option>
            </select>
          </div>

          {/* YouTube OAuth fields */}
          {platform === "youtube" && (
            <>
              {isYouTubeConnected && (
                <div className="rounded-[var(--radius-sm)] border px-3 py-2 text-sm" style={{ color: "var(--color-success)", background: "#DCFCE7", borderColor: "#BBF7D0" }}>
                  <span>●</span>
                  <span>Conectado — canal: {ytCreds?.channel_id}</span>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Channel ID
                </label>
                <input
                  type="text"
                  value={ytChannelId}
                  onChange={(e) => setYtChannelId(e.target.value)}
                  placeholder="UCxxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                  className="field-control"
                />
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  ID do canal YouTube (começa com UC). Encontre em: YouTube Studio → Configurações → Informações do canal.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Google Client ID
                </label>
                <input
                  type="text"
                  value={ytClientId}
                  onChange={(e) => setYtClientId(e.target.value)}
                  placeholder="123456789-abc....apps.googleusercontent.com"
                  required
                  className="field-control"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Google Client Secret
                </label>
                <input
                  type="password"
                  value={ytClientSecret}
                  onChange={(e) => setYtClientSecret(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="field-control"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Data de início do histórico
                </label>
                <input
                  type="date"
                  value={ytHistoryStart}
                  onChange={(e) => setYtHistoryStart(e.target.value)}
                  required
                  className="field-control"
                />
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Define até onde o backfill vai buscar dados históricos.
                </p>
              </div>
            </>
          )}

          {/* Instagram fields */}
          {platform === "instagram" && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Access Token
                </label>
                <input
                  type="text"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAx..."
                  required
                  className="field-control"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  User ID
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="1234567890"
                  required
                  className="field-control"
                />
              </div>
            </>
          )}

          {/* Meta Ads fields */}
          {platform === "meta-ads" && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Access Token
                </label>
                <input
                  type="text"
                  value={metaAccessToken}
                  onChange={(e) => setMetaAccessToken(e.target.value)}
                  placeholder="EAAx..."
                  required
                  className="field-control"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Ad Account ID
                </label>
                <input
                  type="text"
                  value={metaAdAccountId}
                  onChange={(e) => setMetaAdAccountId(e.target.value)}
                  placeholder="act_3689989500461"
                  required
                  className="field-control"
                />
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Inclua o prefixo &quot;act_&quot; (ex: act_3689989500461)
                </p>
              </div>
            </>
          )}

          {/* Hotmart fields */}
          {platform === "hotmart" && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Client ID
                </label>
                <input
                  type="text"
                  value={hmClientId}
                  onChange={(e) => setHmClientId(e.target.value)}
                  placeholder="Ex: a1b2c3d4-..."
                  required
                  className="field-control"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Client Secret
                </label>
                <input
                  type="password"
                  value={hmClientSecret}
                  onChange={(e) => setHmClientSecret(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="field-control"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving
                ? "Salvando..."
                : platform === "youtube"
                ? isYouTubeConnected
                  ? "Reconectar com Google"
                  : "Salvar e Conectar com Google"
                : "Salvar conta"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
