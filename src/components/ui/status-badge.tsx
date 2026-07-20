/* Tokens --badge-* existem apenas em .dash-dark (dash-theme.css); fora dele
   valem os fallbacks claros originais. */
const FAMILIES = {
  green: { background: "var(--badge-green-bg, #DCFCE7)", color: "var(--badge-green-fg, #16A34A)" },
  amber: { background: "var(--badge-amber-bg, #FEF9C3)", color: "var(--badge-amber-fg, #B45309)" },
  red: { background: "var(--badge-red-bg, #FEE2E2)", color: "var(--badge-red-fg, #DC2626)" },
  blue: { background: "var(--badge-blue-bg, #DBEAFE)", color: "var(--badge-blue-fg, #1D4ED8)" },
  violet: { background: "var(--badge-violet-bg, #F3E8FF)", color: "var(--badge-violet-fg, #7C3AED)" },
  gray: { background: "var(--badge-gray-bg, #F1F5F9)", color: "var(--badge-gray-fg, #475569)" },
};

const STATUS_STYLES: Record<string, { background: string; color: string; label?: string }> = {
  approved: { ...FAMILIES.green, label: "Aprovado" },
  active: { ...FAMILIES.green, label: "Ativo" },
  success: { ...FAMILIES.green, label: "Sucesso" },
  pending: { ...FAMILIES.amber, label: "Pendente" },
  cancelled: { ...FAMILIES.red, label: "Cancelado" },
  inactive: { ...FAMILIES.red, label: "Inativo" },
  error: { ...FAMILIES.red, label: "Erro" },
  analysis: { ...FAMILIES.blue, label: "Em análise" },
  refunded: { ...FAMILIES.violet, label: "Reembolsado" },
  blocked: { ...FAMILIES.gray, label: "Bloqueado" },
  expired: { ...FAMILIES.gray, label: "Expirado" },
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
