import type { ReportKind, ReportPage } from "../src/reports.js";

export interface ManagerViewOptions {
  container: HTMLElement;
  request: (path: string) => Promise<any>;
  download: (path: string) => Promise<void>;
  openShop: (id: string) => void;
  today: string;
  team?: { id: string; name: string; role?: string }[];
}
const h=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const when=(value:unknown)=>value?new Intl.DateTimeFormat("en-AE",{timeZone:"Asia/Dubai",dateStyle:"medium",timeStyle:"short"}).format(new Date(String(value))):"—";
const day=(value:unknown)=>value?new Intl.DateTimeFormat("en-AE",{timeZone:"Asia/Dubai",dateStyle:"medium"}).format(new Date(`${String(value).slice(0,10)}T12:00:00+04:00`)):"—";
const button=(label:string,attrs:string,primary=false)=>`<button type="button" class="button${primary?" primary":""}" ${attrs}>${h(label)}</button>`;
const cell=(label:string,value:string)=>`<td data-label="${h(label)}">${value}</td>`;
const table=(headers:string[],rows:string[])=>`<div class="table-wrap mobile-cards"><table><thead><tr>${headers.map(x=>`<th>${h(x)}</th>`).join("")}</tr></thead><tbody>${rows.join("")||`<tr><td class="empty" colspan="${headers.length}">No saved records match these dates and sales executive.</td></tr>`}</tbody></table></div>`;
const panel=(title:string,caption:string,body:string)=>`<section class="panel section-gap"><div class="panel-head"><div><h2 class="panel-title">${h(title)}</h2><p class="panel-caption">${h(caption)}</p></div></div>${body}</section>`;

/** Container-scoped events keep manager filters separate from ordinary shop filters. */
export function createManagerView(options:ManagerViewOptions) {
  const {container,request,download,openShop}=options;
  let from=options.today,to=options.today,person="",kind:ReportKind="activity",status="pending",scope="outstanding",page=0;
  let activity:ReportPage|undefined,report:ReportPage|undefined,busy=false,disposed=false,version=0,error="";
  const path=(exportFormat?:string)=>{
    const params=new URLSearchParams({from,to,person,page:String(page),status,scope});
    return `/reports/${kind}${exportFormat?"/export":""}?${params}${exportFormat?`&format=${exportFormat}`:""}`;
  };
  const shop=(row:Record<string,any>)=>`<button type="button" class="shop-link" data-manager-shop="${h(row.shop_id)}">${h(row.shop_name)}</button><span class="cell-sub">${h(row.area)}</span>`;
  const badge=(value:unknown)=>`<span class="badge ${/break|pending|open/i.test(String(value))?"amber":"green"}">${h(value)}</span>`;
  function render(){
    if(disposed)return;
    const team=options.team?.filter(x=>!x.role||x.role==="executive")??activity?.staff??[];
    const filter=`<form data-manager-filters class="toolbar"><label class="form-field">From<input class="input" type="date" name="from" value="${h(from)}" required></label><label class="form-field">To<input class="input" type="date" name="to" value="${h(to)}" required></label><label class="form-field">Sales executive<select class="select" name="person"><option value="">All sales executives</option>${team.map(p=>`<option value="${h(p.id)}" ${p.id===person?"selected":""}>${h(p.name)}</option>`).join("")}</select></label><button class="button primary" type="submit" ${busy?"disabled":""}>${busy?"Loading…":"Show activity"}</button>${button("Today","data-manager-today")}</form>`;
    const summary=activity?.summary;
    const kpis=summary?`<section class="kpis">${[["Completed visits",summary.completed_visits,"Checkouts in selected dates"],["Recorded duty sessions",summary.recorded_sessions,"Sessions overlapping these dates"],["Pending follow-ups",summary.pending_followups,"All pending items now"],["Due follow-ups",summary.due_followups,"Pending through selected end date"]].map(([label,value,foot])=>`<article class="kpi"><div class="kpi-top"><span>${h(label)}</span></div><div class="kpi-value">${h(value)}</div><div class="kpi-foot">${h(foot)}</div></article>`).join("")}</section>`:"";
    const staff=activity?panel("Staff activity",`Saved activity for ${day(from)}${from!==to?` to ${day(to)}`:""}. Duty status is current.`,table(["Sales executive","Duty now","Recorded sessions","Completed visits","Pending follow-ups"],(activity.staff??[]).map(s=>`<tr>${cell("Sales executive",button(s.name,`data-manager-person="${h(s.id)}"`)+(s.active?"":"<span class=cell-sub>Inactive account</span>"))}${cell("Duty now",badge(s.duty_status))}${cell("Recorded sessions",h(s.recorded_sessions))}${cell("Completed visits",h(s.completed_visits))}${cell("Pending follow-ups",h(s.pending_followups))}</tr>`))):"";
    const tabs=`<div class="toolbar" aria-label="Report type">${([ ["activity","Visits"],["duty","Duty and breaks"],["followups","Follow-ups"] ] as [ReportKind,string][]).map(([key,label])=>button(label,`data-manager-kind="${key}" aria-pressed="${kind===key}"`,kind===key)).join("")}<span class="results">Download this report:</span>${button("Excel","data-manager-export=\"xlsx\"")}${button("PDF","data-manager-export=\"pdf\"")}</div>`;
    const followFilters=kind==="followups"?`<div class="toolbar"><label class="form-field">Follow-ups<select class="select" data-manager-follow-status><option value="pending" ${status==="pending"?"selected":""}>Pending</option><option value="completed" ${status==="completed"?"selected":""}>Completed</option><option value="cancelled" ${status==="cancelled"?"selected":""}>Cancelled</option><option value="all" ${status==="all"?"selected":""}>All statuses</option></select></label>${status==="pending"?`<label class="form-field">Due dates<select class="select" data-manager-follow-scope><option value="outstanding" ${scope==="outstanding"?"selected":""}>Through end date, including overdue</option><option value="range" ${scope==="range"?"selected":""}>Selected dates only</option></select></label>`:""}</div>`:"";
    let body="";
    if(report&&kind==="activity")body=table(["Sales executive","Shop","Check in","Check out","Outcome"],report.rows.map(v=>`<tr>${cell("Sales executive",h(v.visitor_name))}${cell("Shop",shop(v))}${cell("Check in",h(when(v.checked_in_at)))}${cell("Check out",h(when(v.checked_out_at)))}${cell("Outcome",badge(v.outcome??"Open visit"))}</tr>`));
    if(report&&kind==="duty")body=table(["Sales executive","Duty start / end","Recorded duty","Recorded rest","Break / return history"],report.rows.map(d=>`<tr>${cell("Sales executive",h(d.executive_name)+`<span class="cell-sub">${h(d.state)}</span>`)}${cell("Duty start / end",`${h(when(d.started_at))}<span class="cell-sub">${d.ended_at?h(when(d.ended_at)):"Ongoing"}</span>`)}${cell("Recorded duty",`${h(d.elapsed_minutes)} min`)}${cell("Recorded rest",`${h(d.rest_minutes)} min`)}${cell("Break / return history",d.rests.map((r:Record<string,any>)=>`${h(when(r.started_at))} → ${r.ended_at?h(when(r.ended_at)):"Ongoing"}`).join("<br>")||"No recorded breaks")}</tr>`));
    if(report&&kind==="followups")body=table(["Due date","Shop","Assigned executive","Status"],report.rows.map(f=>`<tr>${cell("Due date",h(day(f.due_date)))}${cell("Shop",shop(f))}${cell("Assigned executive",h(f.owner_name))}${cell("Status",badge(f.status)+(f.status==="pending"&&f.due_date<options.today?"<span class=cell-sub>Overdue</span>":""))}</tr>`));
    const caption=kind==="activity"?"Visits checked in during these dates. Completed totals above count checkouts during these dates.":kind==="duty"?"Recorded minutes are limited to selected dates; ongoing sessions stop at the report time. These are saved duty records, without absence or payroll assumptions.":scope==="outstanding"&&status==="pending"?"All pending items due through the end date, including overdue items. Current assigned executive and status.":"Due dates within the selected dates. Current assigned executive and status.";
    const paging=report?`<div class="pagination">${button("Previous","data-manager-page=\"-1\""+(busy||page===0?" disabled":""))}<span>${report.total?`${page*report.pageSize+1}–${Math.min((page+1)*report.pageSize,report.total)} of ${report.total}`:"0 records"}</span>${button("Next","data-manager-page=\"1\""+(busy||(page+1)*report.pageSize>=report.total?" disabled":""))}</div>`:"";
    container.innerHTML=`<div class="heading"><div><p class="eyebrow">Manager overview</p><h1>Daily activity</h1><p class="subheading">Staff, visits and follow-ups · UAE time</p></div></div>${panel("Choose dates and sales executive","Today is selected to help you start quickly.",filter)}<div role="status" aria-live="polite">${busy?"Loading saved activity…":""}</div>${error?`<p class="error" role="alert">${h(error)} ${button("Retry","data-manager-retry")}</p>`:""}${kpis}${staff}${panel({activity:"Visit report",duty:"Duty and breaks",followups:"Follow-up report"}[kind],caption,tabs+followFilters+body+paging)}${activity?`<p class="help">Last refreshed ${h(when(activity.asOf))}. Use Show activity to refresh. Opening a shop shows its full history.</p>`:""}`;
  }
  async function load(){
    if(disposed)return;
    const current=++version;busy=true;error="";activity=undefined;report=undefined;render();
    try{
      const overviewPath=`/reports/activity?${new URLSearchParams({from,to,person})}`;
      const [overview,data]=await Promise.all([request(overviewPath),request(path())]);
      if(disposed||current!==version)return;
      activity=overview;report=data;
    }catch(e){if(disposed||current!==version)return;activity=undefined;report=undefined;error=e instanceof Error?e.message:"Activity could not be loaded. Check your connection and retry.";}
    finally{if(!disposed&&current===version){busy=false;render();}}
  }
  const submit=(e:Event)=>{const form=(e.target as HTMLElement).closest<HTMLFormElement>("[data-manager-filters]");if(!form)return;e.preventDefault();const data=new FormData(form);from=String(data.get("from"));to=String(data.get("to"));person=String(data.get("person"));page=0;void load();};
  const change=(e:Event)=>{const target=e.target as HTMLSelectElement;if(target.matches("[data-manager-follow-status]")){status=target.value;scope=status==="pending"?"outstanding":"range";}else if(target.matches("[data-manager-follow-scope]"))scope=target.value;else return;page=0;void load();};
  const click=async(e:Event)=>{
    const target=(e.target as HTMLElement).closest<HTMLButtonElement>("button");if(!target||!container.contains(target))return;
    if(target.dataset.managerShop){openShop(target.dataset.managerShop);return;}
    if(target.dataset.managerExport){if(busy)return;target.disabled=true;try{await download(path(target.dataset.managerExport));}catch(e){error=e instanceof Error?e.message:"The report could not be downloaded. Please retry.";render();}finally{target.disabled=false;}return;}
    if(target.hasAttribute("data-manager-today")){from=options.today;to=options.today;page=0;}
    else if(target.hasAttribute("data-manager-retry")){}
    else if(target.dataset.managerPerson){person=target.dataset.managerPerson;page=0;}
    else if(target.dataset.managerKind){kind=target.dataset.managerKind as ReportKind;page=0;}
    else if(target.dataset.managerPage){page=Math.max(0,page+Number(target.dataset.managerPage));}
    else return;
    await load();
  };
  container.addEventListener("submit",submit);container.addEventListener("change",change);container.addEventListener("click",click);
  render();
  return {load,dispose(){disposed=true;++version;container.removeEventListener("submit",submit);container.removeEventListener("change",change);container.removeEventListener("click",click);}};
}
