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
import { fmtBRL, fmtDateFull } from "./format";
import { purchaseCategoryLabel } from "./purchases-mode";

const DATE_HEADER = { renovacao: "Data da renovação", compra: "Data da compra" };

function needsQuoting(value: string): boolean {
  return /[;,"\n\r]/.test(value);
}

// Campos começando com = + - @ TAB ou CR seriam interpretados como fórmula
// pelo Excel/LibreOffice (CSV injection) — dados de upload/Hotmart não são
// confiáveis. Neutraliza com apóstrofo à frente (recomendação OWASP).
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCsvField(rawValue: string): string {
  const value = neutralizeFormula(rawValue);
  if (!needsQuoting(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function extraValueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return String(value);
}

// `purchasesOnly` reetiqueta a coluna de categoria e o cabeçalho de data para
// o vocabulário de compras (migration 059), para o CSV bater com a visão da
// tela — mesma fonte, mesma língua.
export function buildRosterCsv(rows: UltimatesRosterRow[], purchasesOnly = false): string {
  const fixedHeaders = [
    "Nome",
    "Email",
    "Telefone",
    "Categoria",
    purchasesOnly ? DATE_HEADER.compra : DATE_HEADER.renovacao,
    "Valor",
  ];
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

  const headerLine = [...fixedHeaders, ...extraKeys].map(escapeCsvField).join(";");

  const dataLines = rows.map((row) => {
    const fixed = [
      row.name ?? "",
      row.email,
      row.phone ?? "",
      purchaseCategoryLabel(row.category, purchasesOnly),
      fmtDateFull(row.renewed_at),
      row.total_value === null ? "—" : fmtBRL(row.total_value),
    ];
    const extras = extraKeys.map((key) => extraValueToString(row.extra?.[key]));
    return [...fixed, ...extras].map(escapeCsvField).join(";");
  });

  return "﻿" + [headerLine, ...dataLines].join("\r\n");
}
