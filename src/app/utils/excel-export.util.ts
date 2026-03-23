import * as XLSX from 'xlsx';

export function exportToExcel(sheets: { [sheetName: string]: any[] }, fileName: string) {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  XLSX.writeFile(wb, fileName);
}
