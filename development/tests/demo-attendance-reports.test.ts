import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DemoStore,STORAGE_KEY} from "../demo/store.js";
import {profiles,createData,type Source} from "../demo/data.js";
import {demoReport,demoPrintHtml,demoWorkbook} from "../demo/reports.js";

const source:Source=JSON.parse(await readFile(new URL("../fixtures/reference-synthetic.json",import.meta.url),"utf8"));
function fixture(){
  const now=new Date("2026-10-21T12:00:00Z"),state=createData(source,now);
  state.profileId=profiles[3].id;state.sessions=[
    {id:"overnight",executive_id:profiles[0].id,started_at:"2026-10-20T19:15:00Z",ended_at:"2026-10-20T21:45:00Z"},
    {id:"second",executive_id:profiles[0].id,started_at:"2026-10-21T06:00:00Z",ended_at:"2026-10-21T09:00:00Z"},
  ];state.rests=[
    {id:"midnight-break",session_id:"overnight",started_at:"2026-10-20T19:45:00Z",ended_at:"2026-10-20T20:15:00Z"},
    {id:"second-break",session_id:"second",started_at:"2026-10-21T07:00:00Z",ended_at:"2026-10-21T07:30:00Z"},
  ];
  const values=new Map([[STORAGE_KEY,JSON.stringify(state)]]),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  return {store:new DemoStore(storage,source,()=>now),values};
}
const path=(from="2026-10-21",to=from,person="")=>`/reports/attendance/export?from=${from}&to=${to}&person=${person}`;

test("Attendance exports reconcile daily, staff, session and break totals across UAE midnight",()=>{
  const {store}=fixture(),report=demoReport(store,path()),ahmed=report.rows.find((r:any)=>r.executive_id===profiles[0].id);
  assert.equal(report.title,"Staff Attendance & Working Hours");assert.equal(report.rows.length,4);
  assert.equal(ahmed.duty_ms,285*60000);assert.equal(ahmed.break_ms,45*60000);assert.equal(ahmed.net_ms,240*60000);
  assert.equal(ahmed.duty_duration,"4h 45m");assert.equal(ahmed.net_duration,"4h 0m");
  assert.equal(ahmed.first_start,"20/10/2026, 23:15:00");assert.equal(ahmed.last_end,"21/10/2026, 13:00:00");
  for(const field of ["duty_ms","break_ms","net_ms"])assert.equal(report.sessionRows.reduce((n:number,r:any)=>n+r[field],0),report.summary[field]);
  assert.equal(report.breakRows.reduce((n:number,r:any)=>n+r.break_ms,0),report.summary.break_ms);
  const overnight=report.sessionRows.find((r:any)=>r.id==="overnight");assert.equal(overnight.started_at,"20/10/2026, 23:15:00");assert.equal(overnight.clipped_start,"21/10/2026, 00:00:00");
  const whole=demoReport(store,path("2026-10-20","2026-10-21",profiles[0].id));assert.equal(whole.summary.duty_ms,330*60000);assert.equal(whole.summary.break_ms,60*60000);assert.equal(whole.summary.net_ms,270*60000);assert.equal(whole.staff,profiles[0].name);assert.equal(whole.rows.length,2);
  assert.equal(report.rows.find((r:any)=>r.executive_id===profiles[1].id).status,"No duty recorded");
});

test("Attendance Excel and print use the same filtered rows, exact totals, Unicode and escaped text",async()=>{
  const {store}=fixture(),report=demoReport(store,path("2026-10-21","2026-10-21",profiles[0].id));
  const name="Ahmed — مؤسسة മാതൃക <sample>";for(const section of [report.rows,report.staffRows,report.sessionRows,report.breakRows])for(const row of section)row.executive_name=name;
  const book=await demoWorkbook(report),bytes=await book.xlsx.writeBuffer();
  const {default:ExcelJS}=await import("exceljs"),loaded=new ExcelJS.Workbook();await loaded.xlsx.load(bytes);
  assert.deepEqual(loaded.worksheets.map(s=>s.name),["Daily attendance","Staff totals","Duty sessions","Break and return times"]);
  for(const sheet of loaded.worksheets){assert.equal(sheet.getCell("A1").value,"EMERALD INTERLINK — DEMO — Sample Data");assert.equal(sheet.getCell("A5").value,report.totals);assert.equal(sheet.getCell("B3").value,"2026-10-21");assert.equal(sheet.getCell("B4").value,profiles[0].name);}
  const daily=loaded.getWorksheet("Daily attendance")!,dailyHeader=daily.getRows(1,daily.rowCount)!.find(r=>r.getCell(1).value==="UAE date")!;
  assert.equal(daily.getRow(dailyHeader.number+1).getCell(2).value,name);assert.equal(daily.getRow(dailyHeader.number+1).getCell(7).value,"4h 0m");
  const html=demoPrintHtml(report,"https://demo.example.invalid");
  for(const value of ["DEMO — Sample Data","4h 45m","4h 0m","20/10/2026, 23:15:00","21/10/2026, 00:00:00","Current status at report time","Print / Save as PDF","مؤسسة","മാതൃക"])assert.ok(html.includes(value),value);
  assert.ok(html.includes("&lt;sample&gt;"));assert.ok(!html.includes("<sample>"));assert.match(html,/Totals use exact timestamps before rounding/);assert.match(html,/Changes do not synchronize between devices/);
});

test("Attendance print distinguishes an unfinished historical date from the current saved status",()=>{
  const f=fixture(),state=JSON.parse(f.values.get(STORAGE_KEY)!);state.sessions=[{id:"carried",executive_id:profiles[0].id,started_at:"2026-10-20T19:00:00Z",ended_at:"2026-10-21T03:00:00Z"}];state.rests=[];f.values.set(STORAGE_KEY,JSON.stringify(state));
  const report=demoReport(f.store,path("2026-10-20","2026-10-20",profiles[0].id));
  assert.equal(report.rows[0].status,"Duty not ended");assert.equal(report.rows[0].last_end,"No end in this date");assert.equal(report.staffRows[0].current_status,"Off duty");assert.equal(report.sessionRows[0].ended_at,"21/10/2026, 07:00:00");
  const html=demoPrintHtml(report,"https://demo.example.invalid");assert.match(html,/Duty not ended/);assert.match(html,/Off duty/);assert.doesNotMatch(html,/Absent/);
});

test("Attendance export formats combined sub-minute sessions after aggregation",()=>{
  const f=fixture(),state=JSON.parse(f.values.get(STORAGE_KEY)!);state.sessions=[
    {id:"short-one",executive_id:profiles[0].id,started_at:"2026-10-21T06:00:00Z",ended_at:"2026-10-21T06:00:31Z"},
    {id:"short-two",executive_id:profiles[0].id,started_at:"2026-10-21T07:00:00Z",ended_at:"2026-10-21T07:00:31Z"},
  ];state.rests=[];f.values.set(STORAGE_KEY,JSON.stringify(state));
  const report=demoReport(f.store,path("2026-10-21","2026-10-21",profiles[0].id));assert.equal(report.summary.net_ms,62000);assert.equal(report.rows[0].net_duration,"0h 1m");assert.equal(report.staffRows[0].net_duration,"0h 1m");assert.ok(report.sessionRows.every((s:any)=>s.net_duration==="0h 0m"));assert.match(report.totals,/Net working hours: 0h 1m/);
});

test("Existing visit, duty and follow-up Excel and print exports retain their fields",async()=>{
  const {store}=fixture();
  for(const kind of ["activity","duty","followups"]){
    const report=demoReport(store,`/reports/${kind}/export?from=2026-10-21&to=2026-10-21&scope=range&status=all`),book=await demoWorkbook(report),sheet=book.getWorksheet("Sample report")!;
    assert.equal(book.worksheets.length,1);assert.equal(sheet.getCell("A2").value,report.title);
    const header=sheet.getRows(1,sheet.rowCount)!.find(row=>row.getCell(1).value===report.columns[0][1]&&row.getCell(2).value===report.columns[1][1])!;assert.ok(header);
    if(report.rows.length)for(const [index,[key]] of report.columns.entries())assert.equal(sheet.getRow(header.number+1).getCell(index+1).value,report.rows[0][key]??"");
    const html=demoPrintHtml(report,"https://demo.example.invalid");assert.ok(html.includes(report.title));assert.ok(html.includes("DEMO — Sample Data"));
  }
});

test("Attendance exports explain overlapping saved records without altering detail timestamps",async()=>{
  const f=fixture(),state=JSON.parse(f.values.get(STORAGE_KEY)!);state.sessions=[
    {id:"overlap-one",executive_id:profiles[0].id,started_at:"2026-10-21T04:00:00Z",ended_at:"2026-10-21T08:00:00Z"},
    {id:"overlap-two",executive_id:profiles[0].id,started_at:"2026-10-21T06:00:00Z",ended_at:"2026-10-21T10:00:00Z"},
  ];state.rests=[];f.values.set(STORAGE_KEY,JSON.stringify(state));
  const report=demoReport(f.store,path("2026-10-21","2026-10-21",profiles[0].id));
  const warning="Some saved duty times overlap. Totals count overlapping time once; session details retain the saved records.";
  assert.equal(report.summary.overlap_detected,true);assert.equal(report.summary.duty_ms,6*3600000);assert.equal(report.sessionRows.reduce((n:number,row:any)=>n+row.duty_ms,0),8*3600000);assert.equal(report.warning,warning);
  assert.ok(demoPrintHtml(report,"https://demo.example.invalid").includes(warning));
  const book=await demoWorkbook(report);for(const sheet of book.worksheets)assert.ok(sheet.getRows(1,sheet.rowCount)!.some(row=>row.getCell(1).value===warning));
  const normal=demoReport(fixture().store,path());assert.equal(normal.warning,"");assert.ok(!demoPrintHtml(normal,"https://demo.example.invalid").includes(warning));
});

test("Duty and breaks exports show hours and minutes while retaining exact legacy minute fields",()=>{
  const {store}=fixture(),report=demoReport(store,`/reports/duty/export?from=2026-10-21&to=2026-10-21&person=${profiles[0].id}`),second=report.rows.find((row:any)=>row.id==="second");
  assert.equal(second.elapsed_minutes,180);assert.equal(second.rest_minutes,30);assert.equal(second.active_minutes,150);
  assert.equal(second.duty_duration,"3h 0m");assert.equal(second.break_duration,"0h 30m");assert.equal(second.net_duration,"2h 30m");
  assert.match(report.totals,/Duty: 4h 45m/);assert.match(report.totals,/Breaks: 0h 45m/);assert.match(report.totals,/Net working hours: 4h 0m/);assert.doesNotMatch(report.totals,/ min/);
  assert.deepEqual(report.columns.slice(4,7).map((pair:string[])=>pair[1]),["Duty hours","Break hours","Net working hours"]);
});
