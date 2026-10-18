import writeXlsxFile from "write-excel-file/universal";
import { formatDateTimeInZone, sanitizeCell } from "../_shared/spreadsheet.ts";
import { REPORT_TIMEZONE } from "../_shared/config.ts";
import type { ContactLeadRow } from "../_shared/types.ts";

/**
 * Builds the daily leads spreadsheet as raw .xlsx bytes.
 *
 * Kept behind this one narrow (rows) => Promise<Uint8Array> signature so
 * swapping the underlying library is a one-file change. `/universal` is
 * used specifically because it returns a Blob with no Node-stream
 * dependency -- the lowest-risk shape under Deno's npm compatibility layer.
 */

const HEADERS = ["Received", "Name", "Email", "Phone", "Message", "Locale"] as const;

const COLUMN_WIDTHS = [20, 22, 28, 18, 60, 8];

function headerRow() {
  return HEADERS.map((header) => ({ value: header, type: String, fontWeight: "bold" as const }));
}

function textCell(value: string) {
  return { value: sanitizeCell(value), type: String };
}

function leadRow(lead: ContactLeadRow) {
  return [
    textCell(formatDateTimeInZone(lead.created_at, REPORT_TIMEZONE)),
    textCell(lead.name),
    textCell(lead.email),
    textCell(lead.phone ?? ""),
    { ...textCell(lead.message), wrap: true },
    textCell(lead.locale),
  ];
}

export async function buildLeadsWorkbook(leads: ContactLeadRow[]): Promise<Uint8Array> {
  const sheetData = [headerRow(), ...leads.map(leadRow)];
  const blob = await writeXlsxFile(sheetData, {
    columns: COLUMN_WIDTHS.map((width) => ({ width })),
  }).toBlob();

  return new Uint8Array(await blob.arrayBuffer());
}
