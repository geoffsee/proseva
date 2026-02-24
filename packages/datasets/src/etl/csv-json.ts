import { parse } from "csv-parse/sync";

export function csvToJson(csvContent: string): any[] {
  return parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    cast: true,
  });
}
