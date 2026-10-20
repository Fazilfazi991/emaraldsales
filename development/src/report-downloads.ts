import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Fault } from "./domain.js";

/** Serialization only: authorization, filters, snapshot and row cap belong to Reports.exportRows. */
export interface DownloadReport {
  kind: string;
  title: string;
  from: string;
  to: string;
  person: string | null;
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
  sheet.getCell(3, 1).value = report.notes.join(" ");
  sheet.getCell(3, 1).alignment = { wrapText: true, vertical: "top" };
  sheet.getCell(3, 1).font = { size: 10, color: { argb: "FF606B64" } };
  sheet.getRow(3).height = 34;
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
    const record = sheet.addRow(report.columns.map(c => cellValue(row[c.key])));
    record.alignment = { vertical: "top", wrapText: true };
    record.font = { name: "Calibri", size: 11 };
    record.height = 32;
    if (record.number % 2 === 0) record.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F6F2" } };
  }
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, 5 + report.rows.length), column: count } };
  sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:5" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const plain = (value: unknown) => String(value ?? "").replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, "...").replace(/\u2192/g, "to").replace(/\u00a0/g, " ");
function validatePdfText(report: DownloadReport) {
  // Built-in PDF fonts have a defined Latin repertoire. Refuse unsupported scripts honestly
  // rather than download a corrupt PDF; Excel preserves Unicode. A licensed Unicode font is a launch decision.
  const values = [report.title, ...report.notes, ...report.columns.map(c => c.label), ...report.rows.flatMap(r => report.columns.map(c => r[c.key]))];
  if (values.some(v => /[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/.test(plain(v))))
    throw new Fault(422, "PDF_FONT_UNSUPPORTED", "This report contains text the PDF font cannot display. Download Excel to keep the full text.");
}
export async function pdfReport(report: DownloadReport): Promise<Buffer> {
  validatePdfText(report);
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true, info: { Title: report.title, Author: "Emerald Interlink" } });
  const output = new Promise<Buffer>((resolve, reject) => {
    const parts: Buffer[] = [];
    doc.on("data", part => parts.push(Buffer.from(part)));
    doc.on("end", () => resolve(Buffer.concat(parts)));
    doc.on("error", reject);
  });
  const left = 36, width = doc.page.width - 72, bottom = doc.page.height - 42;
  const weights = report.columns.map(c => /notes|reason/i.test(c.label) ? 2.1 : /shop/i.test(c.label) ? 1.65 : /date|time|start|end/i.test(c.label) ? 1.25 : 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map(w => width * w / totalWeight);
  let y = 36;
  const header = () => {
    doc.fillColor("#164d3c").font("Helvetica-Bold").fontSize(16).text("EMERALD INTERLINK", left, 28, { width });
    doc.fillColor("#202b25").fontSize(12).text(plain(report.title), left, 51, { width });
    doc.fillColor("#606b64").font("Helvetica").fontSize(9).text(`${report.from} to ${report.to} | ${report.timeZone} | ${report.total} records`, left, 69, { width });
    doc.fontSize(8).text(plain(report.notes.join(" ")), left, 84, { width });
    y = Math.max(107, doc.y + 12);
    doc.font("Helvetica-Bold").fontSize(8);
    const height = Math.max(29, ...report.columns.map((c, i) => doc.heightOfString(plain(c.label), { width: widths[i] - 12 }) + 14));
    doc.rect(left, y, width, height).fill("#164d3c");
    let x = left;
    report.columns.forEach((c, i) => { doc.fillColor("white").text(plain(c.label), x + 6, y + 7, { width: widths[i] - 12 }); x += widths[i]; });
    y += height;
    doc.font("Helvetica").fontSize(8);
  };
  const newPage = () => { doc.addPage(); header(); };
  header();
  report.rows.forEach((row, index) => {
    // Split content into measured lines, so a long record can continue on another page without truncation.
    const lines = report.columns.map((c, i) => {
      const words = plain(row[c.key]).split(/(\s+)/); const result: string[] = []; let current = "";
      for (const word of words) {
        if (doc.widthOfString(current + word) <= widths[i] - 12) { current += word; continue; }
        if (current.trim()) result.push(current.trim()); current = "";
        for (const char of word) { if (doc.widthOfString(current + char) > widths[i] - 12 && current) { result.push(current); current = ""; } current += char; }
      }
      if (current.trim() || !result.length) result.push(current.trim()); return result;
    });
    let offset = 0; const maxLines = Math.max(...lines.map(v => v.length));
    while (offset < maxLines) {
      if (y + 25 > bottom) newPage();
      const available = Math.max(1, Math.floor((bottom - y - 12) / 11));
      const take = Math.min(available, maxLines - offset); const rowHeight = Math.max(27, take * 11 + 12);
      doc.rect(left, y, width, rowHeight).fill(index % 2 ? "#f1f6f2" : "#ffffff");
      let x = left;
      lines.forEach((value, i) => { value.slice(offset, offset + take).forEach((line, j) => doc.fillColor("#202b25").font("Helvetica").fontSize(8).text(line, x + 6, y + 6 + j * 11, { width: widths[i] - 12, lineBreak: false })); x += widths[i]; });
      doc.moveTo(left, y + rowHeight).lineTo(left + width, y + rowHeight).strokeColor("#dce5de").stroke();
      y += rowHeight; offset += take;
      if (offset < maxLines) newPage();
    }
  });
  if (!report.rows.length) doc.fillColor("#606b64").fontSize(11).text("No records match the selected dates and staff.", left + 8, y + 20, { width: width - 16 });
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page++) {
    doc.switchToPage(page);
    // Footer is deliberately below the content margin; disable flow for this line so
    // PDFKit does not append an otherwise empty page for each footer.
    const margin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fillColor("#606b64").font("Helvetica").fontSize(8).text(`Page ${page + 1} of ${range.count}`, left, doc.page.height - 27, { width, align: "right", lineBreak: false });
    doc.page.margins.bottom = margin;
  }
  doc.end(); return output;
}
