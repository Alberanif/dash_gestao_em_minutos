"use client";

import { useState } from "react";

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onExportCsv?: () => void;
}

function SortIcon({ direction }: { direction?: "asc" | "desc" }) {
  if (!direction) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
        <polyline points="8 9 12 5 16 9" />
        <polyline points="16 15 12 19 8 15" />
      </svg>
    );
  }
  if (direction === "asc") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  onExportCsv,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    return sortDir === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  return (
    <div
      className="bg-white rounded-[10px] overflow-hidden"
      style={{ border: "1px solid var(--color-border)", boxShadow: "var(--shadow-card)" }}
    >
      {/* Toolbar */}
      {onExportCsv && (
        <div
          className="px-4 py-3 flex justify-end"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            style={{ background: "#F1F5F9", color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#E2E8F0";
              (e.currentTarget as HTMLElement).style.color = "var(--color-text)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#F1F5F9";
              (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exportar CSV
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--color-border)" }}>
              {columns.map((col) => {
                const isActive = sortKey === col.key;
                return (
                  <th
                    key={String(col.key)}
                    onClick={() => handleSort(col.key)}
                    className="px-4 py-3 text-left cursor-pointer select-none"
                    style={{
                      color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <span style={{ color: isActive ? "var(--color-primary)" : undefined }}>
                        <SortIcon direction={isActive ? sortDir : undefined} />
                      </span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Nenhum dado encontrado
                </td>
              </tr>
            )}
            {sorted.map((row, i) => (
              <tr
                key={i}
                style={{
                  background: i % 2 === 0 ? "white" : "#FAFBFD",
                  borderBottom: i < sorted.length - 1 ? "1px solid #F1F5F9" : undefined,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#EFF6FF";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "white" : "#FAFBFD";
                }}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className="px-4 py-3"
                    style={{ color: "var(--color-text)" }}
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
