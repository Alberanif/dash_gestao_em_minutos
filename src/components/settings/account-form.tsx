"use client";

import { useState } from "react";
import type { Account } from "@/types/accounts";

interface AccountFormProps {
  account?: Account;
  onSave: () => void;
  onCancel: () => void;
}

export function AccountForm({ account, onSave, onCancel }: AccountFormProps) {
  const isEditing = !!account;
  const [name, setName] = useState(account?.name ?? "");
  const [platform, setPlatform] = useState<"youtube" | "instagram">(
    account?.platform ?? "youtube"
  );
  const [apiKey, setApiKey] = useState(
    isEditing && account.platform === "youtube"
      ? (account.credentials as { api_key: string }).api_key
      : ""
  );
  const [channelId, setChannelId] = useState(
    isEditing && account.platform === "youtube"
      ? (account.credentials as { channel_id: string }).channel_id
      : ""
  );
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const credentials =
      platform === "youtube"
        ? { api_key: apiKey, channel_id: channelId }
        : { access_token: accessToken, user_id: userId };

    try {
      const url = isEditing
        ? `/api/accounts/${account.id}`
        : "/api/accounts";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, platform, credentials }),
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4">
          {isEditing ? "Editar conta" : "Nova conta"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                setPlatform(e.target.value as "youtube" | "instagram")
              }
              disabled={isEditing}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>

          {platform === "youtube" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel ID
                </label>
                <input
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="UCxx..."
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

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

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar conta"}
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
