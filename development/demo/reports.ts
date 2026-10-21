import type { DemoStore } from "./store.js";
import type { Row } from "./data.js";
import { profiles } from "./data.js";
const h=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
export function demoReport(store:DemoStore,path:string){
  const url=new URL(path,"https://demo.invalid"),kind=url.pathname.split("/")[2],report=store.report(kind,url.searchParams,true);
  const date=(value:any)=>value?new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Dubai",dateStyle:"short",timeStyle:"short",hour12:false}).format(new Date(value)):"";
  const columns:Record<string,[string,string][]>={
    activity:[["visitor_name","Sales executive"],["shop_name","Shop"],["area","Area"],["checked_in_at","Check in (UAE)"],["checked_out_at","Check out (UAE)"],["outcome","Outcome"],["notes","Discussion"]],
    duty:[["executive_name","Sales executive"],["started_at","Duty start (UAE)"],["ended_at","Duty end (UAE)"],["state","Status"],["elapsed_minutes","Duty minutes"],["rest_minutes","Break minutes"],["active_minutes","Duty less break minutes"],["rest_history","Break / return history (UAE)"]],
    followups:[["owner_name","Assigned executive"],["shop_name","Shop"],["area","Area"],["due_date","Due date (UAE)"],["status","Status"]],
  };
  const rows=report.rows.map((row:Row)=>{const copy={...row};for(const key of ["checked_in_at","checked_out_at","started_at","ended_at"])if(key in copy)copy[key]=date(copy[key]);if(kind==="duty")copy.rest_history=row.rests.map((r:Row)=>`${date(r.started_at)} → ${r.ended_at?date(r.ended_at):"Ongoing"}`).join("; ");return copy;});
  const staff=profiles.find(p=>p.id===report.person)?.name??"All sales executives";
  const sum=(key:string)=>Math.round(report.rows.reduce((n:number,r:Row)=>n+Number(r[key]??0),0)*100)/100;
  const totals=kind==="activity"?`Visits started: ${report.total} · Visits completed in dates: ${report.summary.completed_visits} · Pending follow-ups now: ${report.summary.pending_followups}`:kind==="duty"?`Sessions: ${report.total} · Duty: ${sum("elapsed_minutes")} min · Breaks: ${sum("rest_minutes")} min · Duty less breaks: ${sum("active_minutes")} min`:`Follow-ups: ${report.total} · Pending: ${rows.filter((r:Row)=>r.status==="pending").length} · Completed: ${rows.filter((r:Row)=>r.status==="completed").length}`;
  return {...report,kind,rows,columns:columns[kind],staff,totals,title:({activity:"Visit activity",duty:"Duty and breaks",followups:"Follow-up summary"} as Record<string,string>)[kind]};
}
export async function exportDemoReport(store:DemoStore,path:string){
  const url=new URL(path,"https://demo.invalid"),r=demoReport(store,path);
  if(url.searchParams.get("format")==="pdf"){
    const win=window.open("","_blank");if(!win)throw new Error("Allow this site's report window, then choose Print / Save as PDF again.");
    win.opener=null;
    win.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Emerald Demo — ${h(r.title)}</title><link rel="stylesheet" href="${h(location.origin)}/demo-print.css"></head><body><div class="print-actions"><button type="button" id="print-report">Print / Save as PDF</button><p>In the print dialog, choose Save as PDF. This report contains sample data only.</p></div><header><strong>EMERALD INTERLINK · DEMO — Sample Data</strong><h1>${h(r.title)}</h1><p>${h(r.from)} to ${h(r.to)} · ${h(r.staff)} · Asia/Dubai</p><p>${h(r.totals)}</p><p>Browser-local sample records · Not actual company activity</p>${r.kind==="followups"?`<p>Scope: ${h(r.scope)} · Status: ${h(r.status)}</p>`:""}</header><table><thead><tr>${r.columns.map(([,label]:string[])=>`<th>${h(label)}</th>`).join("")}</tr></thead><tbody>${r.rows.map((row:Row)=>`<tr>${r.columns.map(([key]:string[])=>`<td>${h(row[key])}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${r.columns.length}">No sample records match these filters.</td></tr>`}</tbody></table><footer>DEMO — Sample Data · Generated ${h(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Dubai",dateStyle:"short",timeStyle:"short"}).format(new Date(r.asOf)))} UAE time. Changes do not synchronize between devices.</footer></body></html>`);
    win.document.close();
    win.document.getElementById("print-report")!.addEventListener("click",async()=>{await win.document.fonts.ready;win.print();});
    return;
  }
  const {default:ExcelJS}=await import("exceljs");
  const book=new ExcelJS.Workbook();book.creator="Emerald synthetic client demo";
  const sheet=book.addWorksheet("Sample report");
  sheet.addRow(["EMERALD INTERLINK — DEMO — Sample Data"]);sheet.addRow([r.title]);sheet.addRow(["From",r.from,"To",r.to]);sheet.addRow(["Sales executive",r.staff]);sheet.addRow([r.totals]);sheet.addRow(["Browser-local sample records. Not actual company activity. UAE time."]);
  if(r.kind==="followups")sheet.addRow(["Scope",r.scope,"Status",r.status]);
  sheet.addRow([]);const header=sheet.addRow(r.columns.map(([,label]:string[])=>label));header.font={bold:true,color:{argb:"FFFFFFFF"}};header.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF164D3C"}};
  for(const row of r.rows)sheet.addRow(r.columns.map(([key]:string[])=>row[key]??""));
  sheet.columns.forEach((column:any)=>column.width=26);sheet.eachRow((row:any)=>row.alignment={vertical:"top",wrapText:true});
  sheet.views=[{state:"frozen",ySplit:header.number}];sheet.autoFilter={from:{row:header.number,column:1},to:{row:header.number,column:r.columns.length}};
  const bytes=await book.xlsx.writeBuffer(),blob=new Blob([bytes as BlobPart],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const href=URL.createObjectURL(blob),a=document.createElement("a");a.href=href;a.download=`emerald-DEMO-${r.kind}-${r.from}-${r.to}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(href),10000);
}
