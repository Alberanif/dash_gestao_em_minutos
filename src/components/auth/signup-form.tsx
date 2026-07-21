"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// IGT brand blue extracted from logo: #3B93C3
const IGT_BLUE = "#3B93C3";

const MIN_PASSWORD_LENGTH = 8;

const inputClass =
  "w-full pl-9 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm text-[#1E293B] bg-[#F8FAFC] placeholder:text-[#CBD5E1] outline-none transition-all";

function focusRing(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = IGT_BLUE;
  e.currentTarget.style.boxShadow = `0 0 0 3px ${IGT_BLUE}20`;
}

function blurRing(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "";
  e.currentTarget.style.boxShadow = "";
}

/** Valida no cliente antes de gastar uma tentativa do rate limit da API. */
function localValidationError(
  name: string,
  email: string,
  password: string,
  passwordConfirm: string
): string | null {
  if (name.trim() === "") return "Informe seu nome completo";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Informe um e-mail válido";
  if (password.length < MIN_PASSWORD_LENGTH)
    return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`;
  if (password !== passwordConfirm) return "As senhas não coincidem";
  return null;
}

export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const invalid = localValidationError(name, email, password, passwordConfirm);
    if (invalid) {
      setError(invalid);
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, passwordConfirm }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Não foi possível enviar sua solicitação.");
      setLoading(false);
      return;
    }

    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-dvh flex">

      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-shrink-0 flex-col items-center justify-between py-16 px-10 relative overflow-hidden"
        style={{ backgroundColor: IGT_BLUE }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div />

        <div className="relative z-10 flex flex-col items-center gap-6 text-center">
          <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-xl">
            <Image
              src="/igt-logo.png"
              alt="IGT"
              width={144}
              height={144}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-white font-semibold text-2xl tracking-tight">
              Gestão em 4 Minutos
            </h1>
            <p className="text-white/60 text-sm font-medium tracking-wider uppercase">
              Painel Interno
            </p>
          </div>
        </div>

        <p className="relative z-10 text-white/40 text-xs">
          © {new Date().getFullYear()} IGT Coaching
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#F8FAFC]">
        <div className="w-full max-w-sm">

          {/* Mobile-only logo */}
          <div className="lg:hidden mb-10 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden shadow-md">
              <Image
                src="/igt-logo.png"
                alt="IGT"
                width={80}
                height={80}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <p className="text-[#1E293B] font-semibold text-lg">Gestão em 4 Minutos</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] px-8 py-10">
            {submitted ? (
              <div className="text-center">
                <span
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-5"
                  style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}
                >
                  <CheckIcon />
                </span>
                <h2 className="text-xl font-semibold text-[#1E293B] tracking-tight">
                  Solicitação enviada!
                </h2>
                <p className="text-[#64748B] text-sm mt-3 leading-relaxed">
                  Você poderá entrar assim que um administrador aprovar seu acesso.
                </p>
                <Link
                  href="/login"
                  className="inline-block mt-7 text-sm font-medium"
                  style={{ color: IGT_BLUE }}
                >
                  Voltar para o login
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-[#1E293B] tracking-tight">
                    Solicitar acesso
                  </h2>
                  <p className="text-[#94A3B8] text-sm mt-1">
                    Crie sua conta — um administrador aprovará seu acesso.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

                  {/* Nome */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="name" className="text-sm font-medium text-[#475569]">
                      Nome completo
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
                        <UserIcon />
                      </span>
                      <input
                        id="name"
                        type="text"
                        placeholder="Maria Silva"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoComplete="name"
                        className={inputClass}
                        onFocus={focusRing}
                        onBlur={blurRing}
                      />
                    </div>
                  </div>

                  {/* E-mail */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className="text-sm font-medium text-[#475569]">
                      E-mail
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
                        <MailIcon />
                      </span>
                      <input
                        id="email"
                        type="email"
                        placeholder="usuario@igtcoaching.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className={inputClass}
                        onFocus={focusRing}
                        onBlur={blurRing}
                      />
                    </div>
                  </div>

                  {/* Senha */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="password" className="text-sm font-medium text-[#475569]">
                      Senha
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
                        <LockIcon />
                      </span>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo de 8 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className={`${inputClass} pr-11`}
                        onFocus={focusRing}
                        onBlur={blurRing}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors cursor-pointer"
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar senha */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="passwordConfirm" className="text-sm font-medium text-[#475569]">
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
                        <LockIcon />
                      </span>
                      <input
                        id="passwordConfirm"
                        type={showPassword ? "text" : "password"}
                        placeholder="Repita a senha"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        required
                        autoComplete="new-password"
                        className={inputClass}
                        onFocus={focusRing}
                        onBlur={blurRing}
                      />
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div
                      className="flex items-center gap-2 text-[#DC2626] text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2.5"
                      role="alert"
                      aria-live="polite"
                    >
                      <span className="flex-shrink-0"><AlertIcon /></span>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-opacity cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
                    style={{
                      backgroundColor: loading ? `${IGT_BLUE}99` : IGT_BLUE,
                      boxShadow: loading ? "none" : `0 2px 8px 0 ${IGT_BLUE}40`,
                    }}
                  >
                    {loading ? (
                      <>
                        <SpinnerIcon />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      "Solicitar acesso"
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          {!submitted && (
            <p className="text-center text-[#94A3B8] text-xs mt-5">
              Já tem conta?{" "}
              <Link href="/login" className="font-medium" style={{ color: IGT_BLUE }}>
                Entrar
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
