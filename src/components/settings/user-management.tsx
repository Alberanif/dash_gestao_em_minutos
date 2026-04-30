"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/types/auth";

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  last_sign_in_at: string | null;
}

export function UserManagement() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showChangeRole, setShowChangeRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("comum");
  const [newRole, setNewRole] = useState<UserRole>("comum");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
  }

  useEffect(() => {
    async function getCurrentUser() {
      const res = await fetch("/api/auth/user");
      if (res.ok) {
        const data = await res.json();
        setCurrentUserId(data.id);
      }
    }

    getCurrentUser();
  }, []);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao criar usuário");
    } else {
      setEmail("");
      setPassword("");
      setRole("comum");
      setShowForm(false);
      await loadUsers();
    }

    setSaving(false);
  }

  async function handleChangeRole(userId: string, newRoleValue: UserRole) {
    setSaving(true);
    setError("");

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRoleValue }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao alterar função");
    } else {
      setShowChangeRole(null);
      await loadUsers();
    }

    setSaving(false);
  }

  async function handleDelete(user: AuthUser) {
    if (
      !confirm(`Remover o acesso de "${user.email}"? Esta ação não pode ser desfeita.`)
    )
      return;

    await fetch(`/api/admin/users?id=${user.id}`, { method: "DELETE" });
    await loadUsers();
  }

  const roleColors: Record<UserRole, { bg: string; text: string }> = {
    gestor: { bg: "#fef08a", text: "#a16207" },
    analista: { bg: "#e0e7ff", text: "#4f46e5" },
    comum: { bg: "#dbeafe", text: "#0369a1" },
  };

  const roleLabels: Record<UserRole, string> = {
    gestor: "Gestor",
    analista: "Analista",
    comum: "Comum",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Usuários com acesso</h2>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Controle de acesso ao painel administrativo.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary"
        >
          + Novo usuário
        </button>
      </div>

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-3 rounded-[var(--radius-card)] px-4 py-4"
            style={{ background: "#F8FAFC", border: "1px solid var(--color-border)" }}
          >
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{user.email}</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Cadastrado em{" "}
                {new Date(user.created_at).toLocaleDateString("pt-BR")}
                {user.last_sign_in_at && (
                  <>
                    {" · "}Último acesso:{" "}
                    {new Date(user.last_sign_in_at).toLocaleDateString("pt-BR")}
                  </>
                )}
              </p>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                background: roleColors[user.role].bg,
                color: roleColors[user.role].text,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {roleLabels[user.role]}
            </div>

            <div style={{ display: "flex", gap: 2 }}>
              {user.id !== currentUserId && (
                <button
                  onClick={() => {
                    setShowChangeRole(user.id);
                    setNewRole(user.role);
                  }}
                  className="text-sm"
                  style={{ color: "var(--color-primary)" }}
                >
                  alterar função
                </button>
              )}
              {user.id !== currentUserId && (
                <button
                  onClick={() => handleDelete(user)}
                  className="text-sm"
                  style={{ color: "var(--color-danger)" }}
                >
                  remover
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="w-full max-w-sm"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              boxShadow: "var(--shadow-md)",
            }}
          >
            <h3 className="text-lg font-semibold mb-4">Novo usuário</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@exemplo.com"
                  required
                  className="field-control"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className="field-control"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Função
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="field-control"
                >
                  <option value="comum">Comum</option>
                  <option value="analista">Analista</option>
                  <option value="gestor">Gestor</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? "Criando..." : "Criar usuário"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setError("");
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChangeRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="w-full max-w-sm"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              boxShadow: "var(--shadow-md)",
            }}
          >
            <h3 className="text-lg font-semibold mb-4">Alterar função</h3>
            <div className="space-y-4">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="field-control"
              >
                <option value="comum">Comum</option>
                <option value="analista">Analista</option>
                <option value="gestor">Gestor</option>
              </select>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleChangeRole(showChangeRole, newRole)}
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? "Alterando..." : "Alterar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeRole(null);
                    setError("");
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
