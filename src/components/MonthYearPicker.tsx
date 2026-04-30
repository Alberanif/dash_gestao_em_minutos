"use client";

interface MonthYearPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

function getYearRange() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = currentYear - 10;
  const endYear = currentYear + 1;
  const years = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  return years.reverse();
}

export function MonthYearPicker({ value, onChange, label, className }: MonthYearPickerProps) {
  const monthPart = value.substring(5, 7) || "";
  const yearPart = value.substring(0, 4) || "";

  const handleMonthChange = (month: string) => {
    const year = yearPart || new Date().getFullYear().toString();
    onChange(`${year}-${month}`);
  };

  const handleYearChange = (year: string) => {
    const month = monthPart || "01";
    onChange(`${year}-${month}`);
  };

  const years = getYearRange();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>}
      <div style={{ display: "flex", gap: 8 }}>
        <select
          className={className}
          value={monthPart}
          onChange={(e) => handleMonthChange(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <option value="">Mês</option>
          {MONTHS.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        <select
          className={className}
          value={yearPart}
          onChange={(e) => handleYearChange(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <option value="">Ano</option>
          {years.map((year) => (
            <option key={year} value={year.toString()}>
              {year}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
