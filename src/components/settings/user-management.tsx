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
    loadUsers();
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Usuários com acesso</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          + Novo usuário
        </button>
      </div>

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="bg-white border rounded-lg px-4 py-3 flex items-center gap-3"
          >
            <div className="flex-1">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-gray-400">
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
              className="text-red-400 hover:text-red-600 text-sm"
            >
              remover
            </button>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Novo usuário</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@exemplo.com"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Criando..." : "Criar usuário"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setError("");
                  }}
                  className="flex-1 border rounded-md py-2 text-sm text-gray-600 hover:bg-gray-50"
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
