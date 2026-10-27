const FUSO = "America/Sao_Paulo";

/** Bom dia (5h–11h), boa tarde (12h–17h) ou boa noite, pela hora de Brasília. */
export function saudacao(agora: Date): string {
  const hora = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: FUSO,
    }).format(agora),
  );
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

type UsuarioNome = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null;

/** Primeiro nome do cadastro (user_metadata.name); sem ele, a parte local do e-mail. */
export function primeiroNome(user: UsuarioNome): string {
  const nome = user?.user_metadata?.name;
  if (typeof nome === "string" && nome.trim()) return nome.trim().split(/\s+/)[0];
  return user?.email?.split("@")[0] ?? "";
}
