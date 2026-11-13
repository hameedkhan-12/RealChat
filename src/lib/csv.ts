/** Quote a CSV cell and neutralise spreadsheet formulas. */
export function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return '"' + s.replace(/"/g, '""') + '"'
}
export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',')
