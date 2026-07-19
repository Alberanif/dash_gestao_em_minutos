"use client";

import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import type { UserRole } from "@/types/auth";
import type { UltimatesCategory, UltimatesRosterRow } from "@/types/ultimates";
import { filterRosterRows, type CategoryFilter } from "@/lib/ultimates/table-filter";
import { buildRosterCsv } from "@/lib/ultimates/csv-export";
import { fmtBRL, fmtDateFull, categoryLabel } from "@/lib/ultimates/format";

interface RosterTableProps {
  rows: UltimatesRosterRow[];
  role: UserRole;
  // Task #124 conecta o modal de vínculo manual; enquanto não conectado, o
  // botão "Vincular à base" fica desabilitado (slot deixado de propósito —
  // ver PRD issue #114, seção 3.4, critério 7).
  onLinkClick?: (row: UltimatesRosterRow) => void;
}

const CATEGORY_OPTIONS: CategoryFilter[] = [
  "todas",
  "renovado",
  "nao_renovado",
  "renovacao_reembolsada",
  "novo_comprador",
  "novo_reembolsado",
];

function isNewBuyerRow(row: UltimatesRosterRow): boolean {
  return row.buyer_id === null;
}

// DataTable<T> exige T extends Record<string, unknown> (índice de string) —
// UltimatesRosterRow (src/types/ultimates.ts, não editável por esta task) é
// uma interface fechada. A interseção só adiciona o índice de string para
// satisfazer o genérico; não muda o shape real dos dados em tempo de
// execução.
type TableRow = UltimatesRosterRow & Record<string, unknown>;

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// Tabela do roster (PRD issue #114, seção 3.4, critérios 9/10) — busca +
// filtro de categoria são client-side sobre a MESMA lista usada pelos KPIs
// (aggregateRosterKpis) e pelo gráfico, garantindo que os números batam. A
// exportação CSV usa exatamente a visão filtrada atual.
export function RosterTable({ rows, role, onLinkClick }: RosterTableProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("todas");

  const filtered = filterRosterRows(rows, { search, category });
  const isGestor = role === "gestor";

  function handleExportCsv() {
    const csv = buildRosterCsv(filtered);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `dash-ultimates-roster-${today}.csv`);
  }

  // Shape estrutural do Column<T> de DataTable (não exportado do módulo) —
  // render recebe `unknown` porque TableRow tem índice de string (ver nota
  // acima sobre o cast); cada render faz o cast de volta ao tipo real da
  // coluna.
  const columns: {
    key: keyof TableRow;
    label: string;
    render?: (value: unknown, row: TableRow) => React.ReactNode;
  }[] = [
    {
      key: "name",
      label: "Nome",
      render: (value) => (value as UltimatesRosterRow["name"]) ?? "—",
    },
    { key: "email", label: "Email" },
    {
      key: "phone",
      label: "Telefone",
      render: (value) => (value as UltimatesRosterRow["phone"]) ?? "—",
    },
    {
      key: "category",
      label: "Categoria",
      render: (value) => categoryLabel(value as UltimatesCategory),
    },
    {
      key: "renewed_at",
      label: "Data da renovação",
      render: (value) => fmtDateFull(value as UltimatesRosterRow["renewed_at"]),
    },
    {
      key: "total_value",
      label: "Valor",
      render: (value) => {
        const v = value as UltimatesRosterRow["total_value"];
        return v === null ? "—" : fmtBRL(v);
      },
    },
    ...(isGestor
      ? [
          {
            key: "buyer_id" as keyof TableRow,
            label: "Ação",
            render: (_value: unknown, row: TableRow) =>
              isNewBuyerRow(row) ? (
                <button
                  type="button"
                  className="btn-secondary"
                  data-testid={`ultimates-link-buyer-${row.email}`}
                  disabled={!onLinkClick}
                  title={!onLinkClick ? "Em breve" : undefined}
                  onClick={() => onLinkClick?.(row)}
                  style={{ fontSize: 12, padding: "5px 10px" }}
                >
                  Vincular à base
                </button>
              ) : (
                "—"
              ),
          },
        ]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou email..."
          className="field-control"
          style={{ maxWidth: 280 }}
          data-testid="ultimates-table-search"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryFilter)}
          className="field-control"
          style={{ maxWidth: 220 }}
          data-testid="ultimates-table-category"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "todas" ? "Todas as categorias" : categoryLabel(opt)}
            </option>
          ))}
        </select>
      </div>

      <DataTable<TableRow>
        data={filtered as TableRow[]}
        columns={columns}
        onExportCsv={handleExportCsv}
      />
    </div>
  );
}
