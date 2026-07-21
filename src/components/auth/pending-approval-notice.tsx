import Image from "next/image";

// Mesma identidade visual do login (IGT brand blue).
const IGT_BLUE = "#3B93C3";

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/**
 * Página de espera da conta pendente. É a única rota liberada pelo proxy
 * enquanto `app_metadata.role === "pendente"`.
 */
export function PendingApprovalNotice() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-8 bg-[#F8FAFC]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4">
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

        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] px-8 py-10 text-center">
          <span
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-5"
            style={{ backgroundColor: `${IGT_BLUE}1A`, color: IGT_BLUE }}
          >
            <ClockIcon />
          </span>

          <h1 className="text-xl font-semibold text-[#1E293B] tracking-tight">
            Sua conta aguarda aprovação do administrador
          </h1>

          <p className="text-[#64748B] text-sm mt-3 leading-relaxed">
            Recebemos sua solicitação de acesso. Assim que um administrador
            aprovar, você poderá usar o painel normalmente.
          </p>

          <p className="text-[#94A3B8] text-xs mt-4 leading-relaxed">
            Já foi aprovado? saia e entre novamente para atualizar sua sessão.
          </p>

          <form action="/api/auth/signout" method="post" className="mt-7">
            <button
              type="submit"
              className="w-full text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-opacity cursor-pointer"
              style={{
                backgroundColor: IGT_BLUE,
                boxShadow: `0 2px 8px 0 ${IGT_BLUE}40`,
              }}
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
