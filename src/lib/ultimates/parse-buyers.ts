// Parser da base de compradores no CLIENTE (PRD issue #114, seção 3.4,
// critério 3). Função pura, sem I/O — a MESMA função serve as duas vias de
// entrada (arquivo CSV e colagem TSV do Sheets/Excel), garantindo que arquivo
// e colagem produzam o mesmo resultado. O objeto de saída (`rows`) já está no
// shape aceito por POST /api/ultimates/cycles/[id]/buyers ({ email, name,
// phone, extra }).
//
// Regras (do brief):
// - primeira linha = cabeçalho; separador = TAB se a primeira linha tiver tab,
//   senão vírgula; aspas RFC 4180 no CSV (campo entre aspas pode conter o
//   separador, quebra de linha e aspas internas duplicadas);
// - mapeamento case-insensitive: coluna CONTENDO "email" é a chave
//   (obrigatória); "nome"/"name" → name; "telefone"/"phone"/"celular" → phone;
//   demais colunas → extra (chave = cabeçalho original, sem perda);
// - linhas sem email válido são reportadas (nº da linha + conteúdo) e ignoradas;
// - duplicados são dedupados, a ÚLTIMA ocorrência vence, e são reportados.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_ALIASES = new Set(["nome", "name"]);
const PHONE_ALIASES = new Set(["telefone", "phone", "celular"]);

export interface ParsedBuyerRow {
  email: string;
  name: string | null;
  phone: string | null;
  extra: Record<string, string>;
}

export interface ParseInvalidRow {
  // Nº da linha física na fonte (1-based; cabeçalho é a linha 1).
  line: number;
  content: string;
  reason: string;
}

export interface ParseBuyersResult {
  rows: ParsedBuyerRow[];
  invalidRows: ParseInvalidRow[];
  duplicates: string[];
  delimiter: "," | "\t";
  // Erro de nível de cabeçalho/entrada (sem coluna de email, entrada vazia).
  // Quando presente, `rows` está vazio.
  error: string | null;
}

interface TokenizedRecord {
  fields: string[];
  line: number; // linha física onde o registro começa (1-based)
}

// Tokenizador RFC 4180: percorre caractere a caractere respeitando aspas,
// devolvendo um registro por linha lógica (campos entre aspas podem conter o
// separador e quebras de linha). Rastreia a linha física inicial de cada
// registro para mensagens de erro.
function tokenize(text: string, delimiter: string): TokenizedRecord[] {
  const records: TokenizedRecord[] = [];
  let field = "";
  let fields: string[] = [];
  let inQuotes = false;
  let physicalLine = 1;
  let recordStartLine = 1;
  let recordHasContent = false;

  function endField() {
    fields.push(field);
    field = "";
  }
  function endRecord() {
    endField();
    records.push({ fields, line: recordStartLine });
    fields = [];
    recordHasContent = false;
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") physicalLine++;
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      recordHasContent = true;
      continue;
    }
    if (ch === delimiter) {
      endField();
      recordHasContent = true;
      continue;
    }
    if (ch === "\r") {
      // CRLF: consome o \n subsequente como parte da mesma quebra.
      if (text[i + 1] === "\n") i++;
      endRecord();
      physicalLine++;
      recordStartLine = physicalLine;
      continue;
    }
    if (ch === "\n") {
      endRecord();
      physicalLine++;
      recordStartLine = physicalLine;
      continue;
    }

    field += ch;
    recordHasContent = true;
  }

  // Último registro (se o texto não terminar em quebra de linha e houver
  // conteúdo pendente).
  if (recordHasContent || field !== "" || fields.length > 0) {
    endRecord();
  }

  return records;
}

// Forma compacta para casamento de cabeçalho: minúsculas sem caracteres não
// alfanuméricos, para que "E-mail principal" case com "email" e "Telefone"
// com "telefone" independente de hífens/espaços/acentos de pontuação.
function compactHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

type ColumnRole =
  | { kind: "email" }
  | { kind: "name" }
  | { kind: "phone" }
  | { kind: "extra"; key: string };

function mapHeader(headerCells: string[]): { roles: ColumnRole[]; hasEmail: boolean } {
  let emailTaken = false;
  let nameTaken = false;
  let phoneTaken = false;

  const roles: ColumnRole[] = headerCells.map((raw) => {
    const norm = compactHeader(raw);
    if (!emailTaken && norm.includes("email")) {
      emailTaken = true;
      return { kind: "email" };
    }
    if (!nameTaken && NAME_ALIASES.has(norm)) {
      nameTaken = true;
      return { kind: "name" };
    }
    if (!phoneTaken && PHONE_ALIASES.has(norm)) {
      phoneTaken = true;
      return { kind: "phone" };
    }
    return { kind: "extra", key: raw.trim() };
  });

  return { roles, hasEmail: emailTaken };
}

function isBlankRecord(fields: string[]): boolean {
  return fields.every((f) => f.trim() === "");
}

export function parseBuyers(text: string): ParseBuyersResult {
  const empty = (error: string | null, delimiter: "," | "\t" = ","): ParseBuyersResult => ({
    rows: [],
    invalidRows: [],
    duplicates: [],
    delimiter,
    error,
  });

  if (!text || text.trim() === "") {
    return empty("Nada para importar: o conteúdo está vazio.");
  }

  // Detecção do separador na primeira linha física (antes de qualquer quebra).
  const firstLineEnd = text.search(/\r\n|\r|\n/);
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const delimiter: "," | "\t" = firstLine.includes("\t") ? "\t" : ",";

  const records = tokenize(text, delimiter);
  if (records.length === 0 || isBlankRecord(records[0].fields)) {
    return empty("Não foi possível ler o cabeçalho.", delimiter);
  }

  const header = records[0];
  const { roles, hasEmail } = mapHeader(header.fields);
  if (!hasEmail) {
    return empty(
      "Coluna de email não encontrada. Inclua uma coluna cujo cabeçalho contenha \"email\".",
      delimiter
    );
  }

  const invalidRows: ParseInvalidRow[] = [];
  const byEmail = new Map<string, ParsedBuyerRow>();
  const counts = new Map<string, number>();

  for (let r = 1; r < records.length; r++) {
    const record = records[r];
    const cells = record.fields;

    if (isBlankRecord(cells)) continue;

    const content = cells.join(delimiter === "\t" ? " | " : ",");

    let email = "";
    let name: string | null = null;
    let phone: string | null = null;
    const extra: Record<string, string> = {};

    roles.forEach((role, colIdx) => {
      const value = (cells[colIdx] ?? "").trim();
      switch (role.kind) {
        case "email":
          email = value.toLowerCase();
          break;
        case "name":
          name = value === "" ? null : value;
          break;
        case "phone":
          phone = value === "" ? null : value;
          break;
        case "extra":
          extra[role.key] = cells[colIdx] ?? "";
          break;
      }
    });

    if (email === "") {
      invalidRows.push({ line: record.line, content, reason: "email ausente" });
      continue;
    }
    if (!EMAIL_REGEX.test(email)) {
      invalidRows.push({ line: record.line, content, reason: "email inválido" });
      continue;
    }

    counts.set(email, (counts.get(email) ?? 0) + 1);
    byEmail.set(email, { email, name, phone, extra }); // última ocorrência vence
  }

  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([email]) => email);

  return {
    rows: [...byEmail.values()],
    invalidRows,
    duplicates,
    delimiter,
    error: null,
  };
}
