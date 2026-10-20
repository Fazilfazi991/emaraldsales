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
test("PDF download emits a real paginated PDF with embedded Unicode fonts", async () => {
  const bytes = await pdfReport({ ...report, total: 100, rows: Array.from({length:100}, (_,i)=>({ staff:"Ahmed Hassan",shop:`Synthetic shop ${i+1}`,status:"Regular Visit" })) });
  assert.equal(bytes.subarray(0,5).toString(), "%PDF-");assert.ok(bytes.length>2000);
  const empty = await pdfReport({...report,total:0,rows:[]});
  assert.equal(empty.toString("latin1").match(/\/Type \/Page\b/g)?.length,1,"An empty report must not gain a blank footer page");
  const unicode=await pdfReport({...report,personName:"أحمد حسن",rows:[{staff:"أحمد حسن",shop:"النور (دبي) 123",status:"Regular Visit"},{staff:"നസീർ മുഹമ്മദ്",shop:"മലബാർ ഹാർഡ്‌വെയർ",status:"Élodie D’Souza"}]});
  assert.ok(unicode.toString("latin1").includes("/FontFile2"),"Font programs must be embedded");
  await assert.rejects(()=>pdfReport({...report,rows:[{staff:"Unsupported 🦄",shop:"Synthetic shop",status:"Regular Visit"}]}), error => (error as {code?:string}).code === "PDF_FONT_UNSUPPORTED");
});
test("Excel keeps Unicode, selected staff context, totals and every repeated break",async()=>{
  const rests=Array.from({length:24},(_,i)=>({started_at:new Date(Date.UTC(2026,9,20,0,i*2)).toISOString(),ended_at:new Date(Date.UTC(2026,9,20,0,i*2+1)).toISOString()}));
  const bytes=await excelReport({...report,kind:"duty",personName:"നസീർ / أحمد",totals:"Duty sessions: 1. Rest: 24 min.",total:1,columns:[{key:"executive_name",label:"Sales executive"},{key:"started_at",label:"Duty started (UAE)"},{key:"rest_history",label:"Break / return history (UAE)"}],rows:[{executive_name:"നസീർ / أحمد",started_at:"20/10/2026, 04:00",rests,rest_history:"Full history"}]});
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as any);const sheet=book.getWorksheet("Report")!;
  assert.ok(sheet.getCell("A3").text.includes("നസീർ / أحمد"));assert.ok(sheet.getCell("A3").text.includes("Generated"));assert.ok(sheet.getCell("A4").text.includes("Rest: 24 min"));
  assert.equal(sheet.getCell("A6").text,"നസീർ / أحمد");assert.equal(sheet.getCell("C6").text,"24 breaks - see Break history sheet");assert.equal(book.getWorksheet("Break history")!.rowCount,25);
});
