import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { excelReport, pdfReport, type DownloadReport } from "../src/report-downloads.js";

const report: DownloadReport = {
  kind: "activity", title: "Staff activity", from: "2026-10-20", to: "2026-10-20",
  person: null, timeZone: "Asia/Dubai", asOf: "2026-10-20T10:00:00Z", total: 2,
  notes: ["Visit times are displayed in Asia/Dubai."],
  columns: [{ key: "staff", label: "Sales executive" }, { key: "shop", label: "Shop" }, { key: "status", label: "Visit outcome" }],
  rows: [{ staff: "Ahmed Hassan", shop: "Al Noor Building Materials", status: "Regular Visit" }, { staff: "Naseer M.", shop: '=HYPERLINK("https://invalid.example")', status: "Follow-up Required" }],
};
test("Excel download retains all rows, safe text values and readable header", async () => {
  const bytes = await excelReport(report); const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes as any);
  const sheet = workbook.getWorksheet("Report")!; assert.equal(sheet.getRow(5).getCell(1).value, "Sales executive");
  assert.equal(sheet.getRow(7).getCell(2).value, report.rows[1].shop);assert.equal(sheet.getRow(7).getCell(2).type, ExcelJS.ValueType.String);
  assert.equal(sheet.rowCount, 7); assert.equal(sheet.getRow(1).getCell(1).font.bold, true);
});
test("PDF download emits a real paginated PDF and refuses unsupported script without corrupt output", async () => {
  const bytes = await pdfReport({ ...report, total: 100, rows: Array.from({length:100}, (_,i)=>({ staff:"Ahmed Hassan",shop:`Synthetic shop ${i+1}`,status:"Regular Visit" })) });
  assert.equal(bytes.subarray(0,5).toString(), "%PDF-");assert.ok(bytes.length>2000);
  await assert.rejects(()=>pdfReport({...report,rows:[{staff:"أحمد",shop:"Synthetic shop",status:"Regular Visit"}]}), error => (error as {code?:string}).code === "PDF_FONT_UNSUPPORTED");
});
