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
  const [platform, setPlatform] = useState<"youtube" | "instagram" | "hotmart">(
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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function buildCredentials() {
    if (platform === "youtube") {
      return { client_id: ytClientId, client_secret: ytClientSecret, history_start_date: ytHistoryStart };
    }
    if (platform === "instagram") {
      return { access_token: accessToken, user_id: userId };
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
    isEditing && account.platform === "youtube" && !!ytCreds?.channel_id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4">
          {isEditing ? "Editar conta" : "Nova conta"}
        </h3>

        <form
          onSubmit={platform === "youtube" ? handleYouTubeConnect : handleSave}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da conta
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: IGT Principal"
              required
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plataforma
            </label>
            <select
              value={platform}
              onChange={(e) =>
                setPlatform(e.target.value as "youtube" | "instagram" | "hotmart")
              }
              disabled={isEditing}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="hotmart">Hotmart</option>
            </select>
          </div>

          {/* YouTube OAuth fields */}
          {platform === "youtube" && (
            <>
              {isYouTubeConnected && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  <span>●</span>
                  <span>Conectado — canal: {ytCreds?.channel_id}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Client ID
                </label>
                <input
                  type="text"
                  value={ytClientId}
                  onChange={(e) => setYtClientId(e.target.value)}
                  placeholder="123456789-abc....apps.googleusercontent.com"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Client Secret
                </label>
                <input
                  type="password"
                  value={ytClientSecret}
                  onChange={(e) => setYtClientSecret(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de início do histórico
                </label>
                <input
                  type="date"
                  value={ytHistoryStart}
                  onChange={(e) => setYtHistoryStart(e.target.value)}
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Define até onde o backfill vai buscar dados históricos.
                </p>
              </div>
            </>
          )}

          {/* Instagram fields */}
          {platform === "instagram" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Token
                </label>
                <input
                  type="text"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAx..."
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="1234567890"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Hotmart fields */}
          {platform === "hotmart" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID
                </label>
                <input
                  type="text"
                  value={hmClientId}
                  onChange={(e) => setHmClientId(e.target.value)}
                  placeholder="Ex: a1b2c3d4-..."
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={hmClientSecret}
                  onChange={(e) => setHmClientSecret(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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
              className="flex-1 border rounded-md py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
