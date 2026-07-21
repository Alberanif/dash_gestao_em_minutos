"use client";

import { useEffect, useState } from "react";
import type { AccountRole, UserRole } from "@/types/auth";

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: AccountRole;
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
  const [approving, setApproving] = useState<string | null>(null);
  const [approveRole, setApproveRole] = useState<UserRole>("comum");
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

  // Aprovar = trocar a role de `pendente` para a escolhida, reusando o PATCH.
  async function handleApprove(userId: string, chosenRole: UserRole) {
    setSaving(true);
    setError("");

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: chosenRole }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao aprovar solicitação");
    } else {
      setApproving(null);
      await loadUsers();
    }

    setSaving(false);
  }

  // Rejeitar = remover a conta do Auth, reusando o DELETE; e-mail fica livre.
  async function handleReject(user: AuthUser) {
    const label = user.name || user.email;
    if (!confirm(`Rejeitar e remover a solicitação de ${label}?`)) return;

    await fetch(`/api/admin/users?id=${user.id}`, { method: "DELETE" });
    await loadUsers();
  }

  const pendingUsers = users.filter((u) => u.role === "pendente");
  const activeUsers = users.filter((u) => u.role !== "pendente");

  const roleColors: Record<UserRole, { bg: string; text: string }> = {
    gestor: { bg: "var(--badge-amber-bg, #fef08a)", text: "var(--badge-amber-fg, #a16207)" },
    analista: { bg: "var(--badge-violet-bg, #e0e7ff)", text: "var(--badge-violet-fg, #4f46e5)" },
    comum: { bg: "var(--badge-blue-bg, #dbeafe)", text: "var(--badge-blue-fg, #0369a1)" },
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

      {pendingUsers.length > 0 && (
        <div className="mb-8">
          <h3
            className="mb-3 text-sm font-semibold"
            style={{ color: "var(--color-text)" }}
          >
            Solicitações pendentes · {pendingUsers.length}
          </h3>
          <ul className="space-y-2" aria-label="Solicitações pendentes">
            {pendingUsers.map((user) => (
              <li
                key={user.id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] px-4 py-4"
                style={{
                  background: "var(--row-pending-bg, #FFFBEB)",
                  border: "1px solid var(--row-pending-border, #FDE68A)",
                }}
              >
                <div className="flex-1">
                  {user.name && (
                    <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                      {user.name}
                    </p>
                  )}
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {user.email}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Solicitado em {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      setApproving(user.id);
                      setApproveRole("comum");
                    }}
                    className="text-sm font-medium transition-colors"
                    style={{
                      padding: "6px 12px",
                      color: "var(--color-primary)",
                      border: "1px solid var(--color-primary)",
                      borderRadius: 6,
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => handleReject(user)}
                    className="text-sm font-medium transition-colors"
                    style={{
                      padding: "6px 12px",
                      color: "var(--color-danger)",
                      border: "1px solid var(--color-danger)",
                      borderRadius: 6,
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Rejeitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2" role="list" aria-label="Usuários com acesso">
        {activeUsers.map((user) => (
          <div
            key={user.id}
            role="listitem"
            className="flex items-center gap-3 rounded-[var(--radius-card)] px-4 py-4"
            style={{ background: "var(--row-subtle-bg, #F8FAFC)", border: "1px solid var(--color-border)" }}
          >
            <div className="flex-1">
              {user.name && (
                <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  {user.name}
                </p>
              )}
              <p
                className={user.name ? "text-xs" : "text-sm font-medium"}
                style={{ color: user.name ? "var(--color-text-muted)" : "var(--color-text)" }}
              >
                {user.email}
              </p>
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
                background: roleColors[user.role as UserRole].bg,
                color: roleColors[user.role as UserRole].text,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {roleLabels[user.role as UserRole]}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {user.id !== currentUserId && (
                <button
                  onClick={() => {
                    setShowChangeRole(user.id);
                    setNewRole(user.role as UserRole);
                  }}
                  className="text-sm font-medium transition-colors"
                  style={{
                    padding: "6px 12px",
                    color: "var(--color-primary)",
                    border: "1px solid var(--color-primary)",
                    borderRadius: 6,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(59, 130, 246, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Alterar função
                </button>
              )}
              {user.id !== currentUserId && (
                <button
                  onClick={() => handleDelete(user)}
                  className="text-sm font-medium transition-colors"
                  style={{
                    padding: "6px 12px",
                    color: "var(--color-danger)",
                    border: "1px solid var(--color-danger)",
                    borderRadius: 6,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Remover
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
              {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
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

      {approving && (
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
            <h3 className="text-lg font-semibold mb-4">Aprovar solicitação</h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="approve-role"
                  className="mb-1 block text-sm font-medium"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Função
                </label>
                <select
                  id="approve-role"
                  value={approveRole}
                  onChange={(e) => setApproveRole(e.target.value as UserRole)}
                  className="field-control"
                >
                  <option value="comum">Comum</option>
                  <option value="analista">Analista</option>
                  <option value="gestor">Gestor</option>
                </select>
              </div>
              {error && (
                <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                  {error}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleApprove(approving, approveRole)}
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? "Aprovando..." : "Confirmar aprovação"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApproving(null);
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
              {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
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
