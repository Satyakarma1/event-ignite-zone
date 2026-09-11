// Pure CSV serialization helpers, kept free of server/Supabase imports so they can
// be unit-tested in isolation (see csv.utils.test.ts).

// A leading =, +, -, @, tab, or carriage return makes Excel / Google Sheets / LibreOffice
// evaluate a cell as a formula. Since exported cells carry user-controlled text
// (names, notes, suggestion titles), that is a formula-injection vector (CWE-1236).
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function escapeCsv(value: unknown): string {
  let str = String(value ?? "");
  // Neutralize formula injection: prefix a single quote so the spreadsheet treats
  // the cell as literal text instead of a formula.
  if (FORMULA_TRIGGER.test(str)) {
    str = `'${str}`;
  }
  // RFC 4180 quoting for delimiters, quotes and newlines.
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.map(escapeCsv).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(","));
  }
  return lines.join("\n");
}
