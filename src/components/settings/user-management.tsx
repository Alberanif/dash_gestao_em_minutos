"use client";

import { useEffect, useState } from "react";

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export function UserManagement() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    async function run() {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data);
    }

    void run();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao criar usuário");
    } else {
      setEmail("");
      setPassword("");
      setShowForm(false);
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
            <button
              onClick={() => handleDelete(user)}
              className="text-sm"
              style={{ color: "var(--color-danger)" }}
            >
              remover
            </button>
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
    </div>
  );
}
