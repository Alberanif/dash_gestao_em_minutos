const STATUS_STYLES: Record<string, { background: string; color: string; label?: string }> = {
  approved: { background: "#DCFCE7", color: "#16A34A", label: "Aprovado" },
  active: { background: "#DCFCE7", color: "#16A34A", label: "Ativo" },
  success: { background: "#DCFCE7", color: "#16A34A", label: "Sucesso" },
  pending: { background: "#FEF9C3", color: "#B45309", label: "Pendente" },
  cancelled: { background: "#FEE2E2", color: "#DC2626", label: "Cancelado" },
  inactive: { background: "#FEE2E2", color: "#DC2626", label: "Inativo" },
  error: { background: "#FEE2E2", color: "#DC2626", label: "Erro" },
  analysis: { background: "#DBEAFE", color: "#1D4ED8", label: "Em análise" },
  refunded: { background: "#F3E8FF", color: "#7C3AED", label: "Reembolsado" },
  blocked: { background: "#F1F5F9", color: "#475569", label: "Bloqueado" },
  expired: { background: "#F1F5F9", color: "#475569", label: "Expirado" },
};

interface StatusBadgeProps {
  tone: keyof typeof STATUS_STYLES;
  label?: string;
}

export function StatusBadge({ tone, label }: StatusBadgeProps) {
  const style = STATUS_STYLES[tone];

  return (
    <span
      className="inline-flex items-center rounded-full px-[10px] py-[3px]"
      style={{
        background: style.background,
        color: style.color,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {label ?? style.label}
    </span>
  );
}
