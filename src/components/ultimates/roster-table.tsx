"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { useMediaQuery } from "@/hooks/use-media-query";
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
  // Desfazer vínculo manual de uma renovação de comprador da base (critério
  // 6). Oferecido em qualquer renovação; o DELETE trata 404 quando a linha não
  // veio de vínculo. Ausente ⇒ ação não disponível (ex.: ciclo encerrado).
  onUnlinkClick?: (row: UltimatesRosterRow) => void;
}

const CATEGORY_OPTIONS: CategoryFilter[] = [
  "todas",
  "renovado",
  "nao_renovado",
  "renovacao_reembolsada",
  "novo_comprador",
  "novo_reembolsado",
];

// Acento por categoria (mesma paleta do dash-theme) — usado no badge dos
// cards mobile.
const CATEGORY_COLOR: Record<UltimatesCategory, string> = {
  renovado: "var(--green)",
  nao_renovado: "var(--red)",
  renovacao_reembolsada: "var(--amber)",
  novo_comprador: "var(--orange)",
  novo_reembolsado: "var(--amber)",
};

const PAGE_SIZE = 10;

function isNewBuyerRow(row: UltimatesRosterRow): boolean {
  return row.buyer_id === null;
}

// Renovação de comprador da base (pode ter vindo de venda por email OU de
// vínculo manual — o roster não distingue; ver unlink-buyer-modal.tsx).
function isRenewedBaseRow(row: UltimatesRosterRow): boolean {
  return (
    row.buyer_id !== null &&
    row.transaction_code !== null &&
    (row.category === "renovado" || row.category === "renovacao_reembolsada")
  );
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

function CategoryBadge({ category }: { category: UltimatesCategory }) {
  const color = CATEGORY_COLOR[category] ?? "var(--text-muted)";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 10,
        whiteSpace: "nowrap",
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
      }}
    >
      {categoryLabel(category)}
    </span>
  );
}

// Botão de ação de uma linha/card (Vincular à base | Desfazer vínculo | nada).
// Mesmos data-testids nas duas visões — só uma delas é renderizada por vez.
function RowAction({
  row,
  onLinkClick,
  onUnlinkClick,
  fullWidth,
}: {
  row: UltimatesRosterRow;
  onLinkClick?: (row: UltimatesRosterRow) => void;
  onUnlinkClick?: (row: UltimatesRosterRow) => void;
  fullWidth?: boolean;
}) {
  const style: React.CSSProperties = fullWidth
    ? { fontSize: 12, padding: "8px 10px", width: "100%" }
    : { fontSize: 12, padding: "5px 10px" };

  if (isNewBuyerRow(row)) {
    return (
      <button
        type="button"
        className="btn-secondary"
        data-testid={`ultimates-link-buyer-${row.email}`}
        disabled={!onLinkClick}
        title={!onLinkClick ? "Indisponível" : undefined}
        onClick={() => onLinkClick?.(row)}
        style={style}
      >
        Vincular à base
      </button>
    );
  }
  if (isRenewedBaseRow(row) && onUnlinkClick) {
    return (
      <button
        type="button"
        className="btn-secondary"
        data-testid={`ultimates-unlink-buyer-${row.email}`}
        onClick={() => onUnlinkClick(row)}
        style={style}
      >
        Desfazer vínculo
      </button>
    );
  }
  return null;
}

// Visão mobile do roster (< 640px): um card por participante, com a MESMA
// lista filtrada, paginação de 10 e exportação CSV da visão da tabela.
function RosterCards({
  rows,
  isGestor,
  onLinkClick,
  onUnlinkClick,
  onExportCsv,
}: {
  rows: UltimatesRosterRow[];
  isGestor: boolean;
  onLinkClick?: (row: UltimatesRosterRow) => void;
  onUnlinkClick?: (row: UltimatesRosterRow) => void;
  onExportCsv: () => void;
}) {
  const [page, setPage] = useState(1);

  // Busca/filtro/refresh no pai mudam `rows` ⇒ volta à página 1. Ajuste no
  // render (padrão react.dev "Adjusting some state when a prop changes"),
  // mesmo racional do DataTable — a regra react-hooks/set-state-in-effect do
  // repo proíbe setState síncrono em efeito.
  const [prevRows, setPrevRows] = useState(rows);
  if (prevRows !== rows) {
    setPrevRows(rows);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div data-testid="ultimates-roster-cards" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onExportCsv}
          className="btn-secondary"
          style={{ fontSize: 12, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {rows.length === 0 && (
        <p
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            textAlign: "center",
            padding: "40px 16px",
            margin: 0,
            background: "var(--surface)",
            border: "1px solid var(--border-vis)",
            borderRadius: 11,
          }}
        >
          Nenhum dado encontrado
        </p>
      )}

      {visible.map((row) => (
        <div
          key={`${row.email}-${row.transaction_code ?? "sem-transacao"}`}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-vis)",
            borderRadius: 11,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
                {row.name ?? "—"}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0", overflowWrap: "anywhere" }}>
                {row.email}
              </p>
              {row.phone && (
                <p style={{ fontSize: 12, color: "var(--text-3)", margin: "2px 0 0" }}>{row.phone}</p>
              )}
            </div>
            <CategoryBadge category={row.category} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-4)", margin: 0 }}>
                Valor
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: "2px 0 0" }}>
                {row.total_value === null ? "—" : fmtBRL(row.total_value)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-4)", margin: 0 }}>
                Renovação
              </p>
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: "2px 0 0" }}>
                {fmtDateFull(row.renewed_at)}
              </p>
            </div>
          </div>

          {isGestor && (
            <RowAction row={row} onLinkClick={onLinkClick} onUnlinkClick={onUnlinkClick} fullWidth />
          )}
        </div>
      ))}

      {rows.length > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{rows.length} registros</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="btn-secondary"
              data-testid="ultimates-roster-prev"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              style={{ fontSize: 12, padding: "5px 10px" }}
            >
              Anterior
            </button>
            <span data-testid="ultimates-roster-page-info" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary"
              data-testid="ultimates-roster-next"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              style={{ fontSize: 12, padding: "5px 10px" }}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Tabela do roster (PRD issue #114, seção 3.4, critérios 9/10) — busca +
// filtro de categoria são client-side sobre a MESMA lista usada pelos KPIs
// (aggregateRosterKpis) e pelo gráfico, garantindo que os números batam. A
// exportação CSV usa exatamente a visão filtrada atual. No mobile (< 640px)
// a lista vira cards (RosterCards) — mesma lista, mesmos fluxos; o DataTable
// compartilhado continua sendo a visão desktop.
export function RosterTable({ rows, role, onLinkClick, onUnlinkClick }: RosterTableProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("todas");
  const isMobile = useMediaQuery("(max-width: 640px)");

  // Memoizado para o reset de página do DataTable (que observa a referência
  // de `data`) disparar só quando linhas/busca/categoria mudam de verdade, e
  // não em re-renders alheios (ex.: abrir um modal do dashboard).
  const filtered = useMemo(
    () => filterRosterRows(rows, { search, category }),
    [rows, search, category]
  );
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
            render: (_value: unknown, row: TableRow) => {
              if (isNewBuyerRow(row) || (isRenewedBaseRow(row) && onUnlinkClick)) {
                return <RowAction row={row} onLinkClick={onLinkClick} onUnlinkClick={onUnlinkClick} />;
              }
              return "—";
            },
          },
        ]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="ult-roster-toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou email..."
          className="field-control ult-roster-search"
          data-testid="ultimates-table-search"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryFilter)}
          className="field-control ult-roster-category"
          data-testid="ultimates-table-category"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "todas" ? "Todas as categorias" : categoryLabel(opt)}
            </option>
          ))}
        </select>
      </div>

      {isMobile ? (
        <RosterCards
          rows={filtered}
          isGestor={isGestor}
          onLinkClick={onLinkClick}
          onUnlinkClick={onUnlinkClick}
          onExportCsv={handleExportCsv}
        />
      ) : (
        <DataTable<TableRow>
          data={filtered as TableRow[]}
          columns={columns}
          onExportCsv={handleExportCsv}
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  );
}
