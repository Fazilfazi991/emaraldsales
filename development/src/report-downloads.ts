
/** Serialization only: authorization, filters, snapshot and row cap belong to Reports.exportRows. */
export interface DownloadReport {
  kind: string;
  title: string;
  from: string;
  to: string;
  person: string | null;
  personName?: string | null;
  totals?: string;
  timeZone: string;
  asOf: string | Date;
  total: number;
  notes: string[];
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}
const cellValue = (value: unknown): string | number =>
  typeof value === "number" && Number.isFinite(value) ? value : String(value ?? "");
export async function excelReport(report: DownloadReport): Promise<Buffer> {
  const {default:ExcelJS}=await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Emerald Interlink";
  workbook.created = new Date(report.asOf);
  const sheet = workbook.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 5 }] });
  const count = report.columns.length;
  sheet.mergeCells(1, 1, 1, count);
  sheet.getCell(1, 1).value = `EMERALD INTERLINK - ${report.title}`;
  sheet.getCell(1, 1).font = { size: 17, bold: true, color: { argb: "FF164D3C" } };
  sheet.getRow(1).height = 30;
  sheet.mergeCells(2, 1, 2, count);
  sheet.getCell(2, 1).value = `${report.from} to ${report.to} | ${report.timeZone} | ${report.total} records`;
  sheet.mergeCells(3, 1, 3, count);
  sheet.getCell(3, 1).value = context(report);
  sheet.getCell(3, 1).alignment = { wrapText: true, vertical: "top" };
  sheet.getCell(3, 1).font = { size: 10, color: { argb: "FF606B64" } };
  sheet.getRow(3).height = 32;
  sheet.mergeCells(4, 1, 4, count);
  sheet.getCell(4, 1).value = [report.totals, ...report.notes].filter(Boolean).join(" ");
  sheet.getCell(4, 1).alignment = { wrapText: true, vertical: "top" };
  sheet.getCell(4, 1).font = { size: 10, color: { argb: "FF606B64" } };
  sheet.getRow(4).height = 52;
  const header = sheet.getRow(5);
  header.values = report.columns.map(c => c.label);
  header.height = 30;
  for (let c = 1; c <= count; c++) {
    const title = report.columns[c - 1].label;
    sheet.getColumn(c).width = /shop|notes|reason/i.test(title) ? 36 : /date|time|start|end/i.test(title) ? 23 : 22;
    header.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF164D3C" } };
    header.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    header.getCell(c).alignment = { vertical: "middle", wrapText: true };
  }
  for (const row of report.rows) {
    // Plain string values never become spreadsheet formulas, even if they start with =, +, - or @.
    const record = sheet.addRow(report.columns.map(c => cellValue(c.key === "rest_history" && report.kind === "duty" && Array.isArray(row.rests) ? `${row.rests.length} breaks - see Break history sheet` : row[c.key])));
    record.alignment = { vertical: "top", wrapText: true };
    record.font = { name: "Calibri", size: 11 };
    record.height = Math.max(32, ...report.columns.map((_, i) => {
      const value = record.getCell(i + 1).text;
      return 16 * value.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil([...line].length / (sheet.getColumn(i + 1).width! * 0.85))), 0) + 8;
    }));
    if (record.number % 2 === 0) record.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F6F2" } };
  }
  if (report.kind === "duty") {
    const breaks = workbook.addWorksheet("Break history", { views: [{ state: "frozen", ySplit: 1 }] });
    breaks.columns = [{header:"Sales executive",key:"staff",width:30},{header:"Duty started (UAE)",key:"duty",width:25},{header:"Break started (UAE)",key:"start",width:25},{header:"Returned (UAE)",key:"end",width:25}];
    const local = (value: unknown) => value ? new Intl.DateTimeFormat("en-GB", {timeZone:"Asia/Dubai",dateStyle:"short",timeStyle:"short",hour12:false}).format(new Date(String(value))) : "Ongoing";
    for (const row of report.rows) if (Array.isArray(row.rests)) for (const rest of row.rests) breaks.addRow([cellValue(row.executive_name),cellValue(row.started_at),local(rest.started_at),local(rest.ended_at)]);
    breaks.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
    breaks.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF164D3C"}};
    breaks.eachRow(row=>{row.height=Math.max(32,...[1,2,3,4].map(i=>16*row.getCell(i).text.split("\n").reduce((n,line)=>n+Math.max(1,Math.ceil([...line].length/(breaks.getColumn(i).width!*0.85))),0)+8));row.alignment={vertical:"top",wrapText:true};});
    breaks.pageSetup={orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:"1:1"};
  }
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, 5 + report.rows.length), column: count } };
  sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:5" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const context = (report: DownloadReport) => `Sales executive: ${report.personName ?? (report.person ? "Selected executive" : "All sales executives")} | Generated ${new Intl.DateTimeFormat("en-GB", {timeZone:"Asia/Dubai",dateStyle:"medium",timeStyle:"short",hour12:false}).format(new Date(report.asOf))} UAE`;
export async function pdfReport(report: DownloadReport): Promise<Buffer> {
  const {renderPdf}=await import("./pdf-report.js");
  return renderPdf(report, context(report));
}
