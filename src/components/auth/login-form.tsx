"use client";

import { useState } from "react";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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

// IGT brand blue extracted from logo: #3B93C3
const IGT_BLUE = "#3B93C3";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex">

      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-shrink-0 flex-col items-center justify-between py-16 px-10 relative overflow-hidden"
        style={{ backgroundColor: IGT_BLUE }}
      >
        {/* Subtle dot-grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Top spacer */}
        <div />

        {/* Center: Logo + system name */}
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

        {/* Bottom: copyright */}
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

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] px-8 py-10">

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-[#1E293B] tracking-tight">
                Acesso ao sistema
              </h2>
              <p className="text-[#94A3B8] text-sm mt-1">
                Use as credenciais fornecidas pelo seu gestor
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

              {/* E-mail */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-[#475569]">
                  E-mail corporativo
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
                    className="w-full pl-9 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm text-[#1E293B] bg-[#F8FAFC] placeholder:text-[#CBD5E1] outline-none transition-all focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": `${IGT_BLUE}40` } as React.CSSProperties}
                    onFocus={(e) => { e.currentTarget.style.borderColor = IGT_BLUE; e.currentTarget.style.boxShadow = `0 0 0 3px ${IGT_BLUE}20`; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; }}
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
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full pl-9 pr-11 py-2.5 border border-[#E2E8F0] rounded-lg text-sm text-[#1E293B] bg-[#F8FAFC] placeholder:text-[#CBD5E1] outline-none transition-all"
                    onFocus={(e) => { e.currentTarget.style.borderColor = IGT_BLUE; e.currentTarget.style.boxShadow = `0 0 0 3px ${IGT_BLUE}20`; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; }}
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
                    <span>Verificando...</span>
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
          </div>

          {/* Below card: support note */}
          <p className="text-center text-[#94A3B8] text-xs mt-5">
            Problemas com acesso? Fale com o administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
