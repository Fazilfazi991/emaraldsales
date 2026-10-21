import type { DemoStore } from "./store.js";
import type { Row } from "./data.js";
import { profiles } from "./data.js";
import { formatDuration as duration } from "./attendance.js";

const h=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
type Columns=[string,string][];
type ReportSection={name:string;columns:Columns;rows:Row[]};
const uaeDate=(value:unknown,seconds=false)=>value?new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Dubai",dateStyle:"short",timeStyle:seconds?"medium":"short",hour12:false}).format(new Date(String(value))):"";
const columns:Record<string,Columns>={
  activity:[["visitor_name","Sales executive"],["shop_name","Shop"],["area","Area"],["checked_in_at","Check in (UAE)"],["checked_out_at","Check out (UAE)"],["outcome","Outcome"],["notes","Discussion"],["order_status","Recorded order status"],["order_value","Recorded order value AED"]],
  duty:[["executive_name","Staff member"],["started_at","Duty start (UAE)"],["ended_at","Duty end (UAE)"],["state","Status"],["duty_duration","Duty hours"],["break_duration","Break hours"],["net_duration","Net working hours"],["rest_history","Break / return history (UAE)"]],
  followups:[["owner_name","Assigned executive"],["shop_name","Shop"],["area","Area"],["due_date","Due date (UAE)"],["status","Status"]],
  attendance:[["date","UAE date"],["executive_name","Staff member"],["first_start","First duty start (UAE)"],["last_end","Last duty end (UAE)"],["duty_duration","Total duty"],["break_duration","Breaks"],["net_duration","Net working hours"],["status","Recorded date status"],["completed_visits","Completed visits"]],
};
const staffColumns:Columns=[["executive_name","Staff member"],["duty_duration","Total duty"],["break_duration","Breaks"],["net_duration","Net working hours"],["completed_visits","Completed visits"],["current_status","Current status at report time"]];
const sessionColumns:Columns=[["executive_name","Staff member"],["session_number","Session"],["started_at","Actual duty start (UAE)"],["ended_at","Actual duty end (UAE)"],["clipped_start","Counted from (UAE)"],["clipped_end","Counted until (UAE)"],["duty_duration","Duty in selected dates"],["break_duration","Breaks in selected dates"],["net_duration","Net working hours"],["state","Status at selected period end"]];
const breakColumns:Columns=[["executive_name","Staff member"],["session_number","Session"],["break_number","Break"],["started_at","Actual break start (UAE)"],["ended_at","Actual return to duty (UAE)"],["clipped_start","Counted from (UAE)"],["clipped_end","Counted until (UAE)"],["break_duration","Break in selected dates"]];
const withDurations=(row:Row)=>({...row,duty_duration:duration(row.duty_ms),break_duration:duration(row.break_ms),net_duration:duration(row.net_ms)});

export function demoReport(store:DemoStore,path:string){
  const url=new URL(path,"https://demo.invalid"),kind=url.pathname.split("/")[2],report=store.report(kind,url.searchParams,true);
  const rows=report.rows.map((row:Row)=>{
    if(kind==="attendance")return {...withDurations(row),first_start:uaeDate(row.first_start,true)||"No duty recorded",last_end:row.last_end?uaeDate(row.last_end,true):row.first_start?"No end in this date":"—"};
    const copy:Row=kind==="duty"?withDurations(row):{...row};for(const key of ["checked_in_at","checked_out_at","started_at","ended_at"])if(key in copy)copy[key]=uaeDate(copy[key]);
    if(kind==="duty")copy.rest_history=row.rests.map((r:Row)=>`${uaeDate(r.started_at)} → ${r.ended_at?uaeDate(r.ended_at):"Ongoing"}`).join("; ");return copy;
  });
  const staff=profiles.find(p=>p.id===report.person)?.name??"All sales executives";
  const sum=(key:string)=>report.summary?.[key]??report.rows.reduce((n:number,r:Row)=>n+Number(r[key]??0),0);
  const totals=kind==="attendance"?`Total duty: ${duration(report.summary.duty_ms)} · Breaks: ${duration(report.summary.break_ms)} · Net working hours: ${duration(report.summary.net_ms)} · Completed visits: ${report.summary.completed_visits}`:kind==="activity"?`Visits started: ${report.total} · Visits completed in dates: ${report.summary.completed_visits} · Pending follow-ups now: ${report.summary.pending_followups} · Confirmed sales at checkout: AED ${(report.summary.confirmed_order_fils/100).toFixed(2)} (separate from collections)`:kind==="duty"?`Sessions: ${report.total} · Duty: ${duration(sum("duty_ms"))} · Breaks: ${duration(sum("break_ms"))} · Net working hours: ${duration(sum("net_ms"))}`:`Follow-ups: ${report.total} · Pending: ${rows.filter((r:Row)=>r.status==="pending").length} · Completed: ${rows.filter((r:Row)=>r.status==="completed").length}`;
  const warning=["attendance","duty"].includes(kind)&&report.summary?.overlap_detected?"Some saved duty times overlap. Totals count overlapping time once; session details retain the saved records.":"";
  const sessionRows:Row[]=[],breakRows:Row[]=[];
  if(kind==="attendance")for(const [index,session] of (report.session_details as Row[]).entries()){
    const numbered={...withDurations(session),session_number:index+1};
    sessionRows.push({...numbered,started_at:uaeDate(session.started_at,true),ended_at:session.ended_at?uaeDate(session.ended_at,true):"Ongoing",clipped_start:uaeDate(session.clipped_start,true),clipped_end:uaeDate(session.clipped_end,true)});
    for(const [breakIndex,rest] of (session.rests as Row[]).entries())breakRows.push({...rest,executive_name:session.executive_name,session_number:index+1,break_number:breakIndex+1,started_at:uaeDate(rest.started_at,true),ended_at:rest.ended_at?uaeDate(rest.ended_at,true):"Not yet returned",clipped_start:uaeDate(rest.clipped_start,true),clipped_end:uaeDate(rest.clipped_end,true),break_duration:duration(rest.break_ms)});
  }
  const staffRows:Row[]=kind==="attendance"?report.totalsByExecutive.map(withDurations):[];
  return {...report,kind,rows,columns:columns[kind],staff,totals,warning,sessionRows,breakRows,staffRows,title:({activity:"Visit activity",duty:"Duty and breaks",followups:"Follow-up summary",attendance:"Staff Attendance & Working Hours"} as Record<string,string>)[kind]};
}
export type DemoReport=ReturnType<typeof demoReport>;
function reportSections(r:DemoReport):ReportSection[]{
  return [{name:r.kind==="attendance"?"Daily attendance":"Sample report",columns:r.columns,rows:r.rows},...(r.kind==="attendance"?[
    {name:"Staff totals",columns:staffColumns,rows:r.staffRows},
    {name:"Duty sessions",columns:sessionColumns,rows:r.sessionRows},
    {name:"Break and return times",columns:breakColumns,rows:r.breakRows},
  ]:[])];
}
const attendanceNote="Durations show completed minutes. Totals use exact timestamps before rounding. Overnight sessions are split at UAE midnight; counted times show only the selected dates. Current status is shown separately from recorded date status.";
function table(cols:Columns,rows:Row[]){return `<table><thead><tr>${cols.map(([,label])=>`<th>${h(label)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${cols.map(([key])=>`<td>${h(row[key])}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${cols.length}">No sample records match these filters.</td></tr>`}</tbody></table>`;}

/** Shared by browser print and export consistency tests. All record values are escaped. */
export function demoPrintHtml(r:DemoReport,origin:string){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Emerald Demo — ${h(r.title)}</title><link rel="stylesheet" href="${h(origin)}/demo-print.css"></head><body><div class="print-actions"><button type="button" id="print-report">Print / Save as PDF</button><p>In the print dialog, choose Save as PDF. This report contains sample data only.</p></div><header><strong>EMERALD INTERLINK · DEMO — Sample Data</strong><h1>${h(r.title)}</h1><p>${h(r.from)} to ${h(r.to)} · ${h(r.staff)} · Asia/Dubai</p><p>${h(r.totals)}</p><p>Browser-local sample records · Not actual company activity</p>${r.kind==="followups"?`<p>Scope: ${h(r.scope)} · Status: ${h(r.status)}</p>`:""}${r.kind==="attendance"?`<p class="report-note">${h(attendanceNote)}</p>`:""}${r.warning?`<p class="report-note">${h(r.warning)}</p>`:""}</header>${reportSections(r).map(section=>`<section><h2>${h(section.name)}</h2>${table(section.columns,section.rows)}</section>`).join("")}<footer>DEMO — Sample Data · Generated ${h(uaeDate(r.asOf,true))} UAE time. Changes do not synchronize between devices.</footer></body></html>`;
}

/** Creates the actual downloadable workbook without depending on browser APIs. */
export async function demoWorkbook(r:DemoReport){
  const {default:ExcelJS}=await import("exceljs");
  const book=new ExcelJS.Workbook();book.creator="Emerald synthetic client demo";
  for(const section of reportSections(r)){
    const sheet=book.addWorksheet(section.name);
    sheet.addRow(["EMERALD INTERLINK — DEMO — Sample Data"]);sheet.addRow([r.title]);sheet.addRow(["From",r.from,"To",r.to]);sheet.addRow(["Sales executive",r.staff]);sheet.addRow([r.totals]);sheet.addRow(["Browser-local sample records. Not actual company activity. UAE time."]);
    sheet.addRow(["Generated (UAE)",uaeDate(r.asOf,true),"Changes do not synchronize between devices."]);
    if(r.kind==="followups")sheet.addRow(["Scope",r.scope,"Status",r.status]);
    if(r.kind==="attendance")sheet.addRow([attendanceNote]);
    if(r.warning)sheet.addRow([r.warning]);
    sheet.addRow([]);const header=sheet.addRow(section.columns.map(([,label])=>label));header.font={bold:true,color:{argb:"FFFFFFFF"}};header.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF164D3C"}};
    for(const row of section.rows)sheet.addRow(section.columns.map(([key])=>row[key]??""));
    if(!section.rows.length)sheet.addRow(["No sample records match these filters."]);
    sheet.columns.forEach(column=>column.width=26);sheet.eachRow(row=>row.alignment={vertical:"top",wrapText:true});
    sheet.views=[{state:"frozen",ySplit:header.number}];sheet.autoFilter={from:{row:header.number,column:1},to:{row:header.number,column:section.columns.length}};
  }
  return book;
}
export async function exportDemoReport(store:DemoStore,path:string){
  const url=new URL(path,"https://demo.invalid"),r=demoReport(store,path);
  if(url.searchParams.get("format")==="pdf"){
    const win=window.open("","_blank");if(!win)throw new Error("Allow this site's report window, then choose Print / Save as PDF again.");
    win.opener=null;win.document.write(demoPrintHtml(r,location.origin));win.document.close();
    win.document.getElementById("print-report")!.addEventListener("click",async()=>{await win.document.fonts.ready;win.print();});return;
  }
  const book=await demoWorkbook(r),bytes=await book.xlsx.writeBuffer(),blob=new Blob([bytes as BlobPart],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const href=URL.createObjectURL(blob),a=document.createElement("a");a.href=href;a.download=`emerald-DEMO-${r.kind}-${r.from}-${r.to}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(href),10000);
}
