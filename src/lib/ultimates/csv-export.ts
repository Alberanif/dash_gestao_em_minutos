// Exportação CSV client-side da tabela do roster (PRD issue #114, seção 3.4,
// critério 10). Recebe as linhas JÁ filtradas (busca + categoria aplicadas
// via filterRosterRows) — este módulo só formata, não filtra.
//
// Convenções: separador ";" (não vírgula — pt-BR usa vírgula como separador
// decimal, e é o que o Excel pt-BR espera como delimitador de lista);
// escaping RFC 4180 (aspas ao redor de campos com ";", ",", aspas ou quebra
// de linha, aspas internas dobradas); BOM UTF-8 no início para o Excel
// pt-BR abrir acentos corretamente.
import type { UltimatesRosterRow } from "@/types/ultimates";
import { fmtBRL, fmtDateFull, categoryLabel } from "./format";

const FIXED_HEADERS = ["Nome", "Email", "Telefone", "Categoria", "Data da renovação", "Valor"];

function needsQuoting(value: string): boolean {
  return /[;,"\n\r]/.test(value);
}

function escapeCsvField(value: string): string {
  if (!needsQuoting(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function extraValueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return String(value);
}

export function buildRosterCsv(rows: UltimatesRosterRow[]): string {
  // União das chaves de `extra` entre todas as linhas exportadas — cada
  // upload pode ter colunas extras diferentes.
  const extraKeys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.extra ?? {})) {
      if (!seen.has(key)) {
        seen.add(key);
        extraKeys.push(key);
      }
    }
  }

  const headerLine = [...FIXED_HEADERS, ...extraKeys].map(escapeCsvField).join(";");

  const dataLines = rows.map((row) => {
    const fixed = [
      row.name ?? "",
      row.email,
      row.phone ?? "",
      categoryLabel(row.category),
      fmtDateFull(row.renewed_at),
      row.total_value === null ? "—" : fmtBRL(row.total_value),
    ];
    const extras = extraKeys.map((key) => extraValueToString(row.extra?.[key]));
    return [...fixed, ...extras].map(escapeCsvField).join(";");
  });

  return "﻿" + [headerLine, ...dataLines].join("\r\n");
}
