import { z } from "zod";
import type { Database, Queryable } from "./database.js";
import { type Actor, Fault, businessDay, calendarDate, dayRange } from "./domain.js";

export type ReportKind = "activity" | "duty" | "followups";
type Row = Record<string, any>;
type Filters = { from: string; to: string; person: string | null; page: number; pageSize: number; status: string; scope: string; start: string; end: string; asOf: string };
export interface ReportPage {
  from: string; to: string; person: string | null; timeZone: "Asia/Dubai"; asOf: string;
  page: number; pageSize: number; total: number; rows: Row[];
  staff?: Row[]; summary?: Row; status?: string; scope?: string;
}
export interface ReportExport {
  kind: ReportKind; title: string; from: string; to: string; person: string | null; personName: string | null; totals: string;
  timeZone: "Asia/Dubai"; asOf: string; total: number; notes: string[];
  columns: { key: string; label: string }[]; rows: Row[];
}
const notes: Record<ReportKind, string[]> = {
  activity: ["Rows are visits checked in during the selected UAE dates. Completed totals count checkouts during those dates, including visits started earlier.", "Open visits, current duty and pending follow-ups describe the current saved state."],
  duty: ["Sessions overlap the selected UAE dates. Recorded minutes are clipped to those dates and the report time for ongoing sessions.", "Recorded duty and rest are elapsed records, not payroll, absence, lateness or approved working hours."],
  followups: ["Date filters use the follow-up due date. Outstanding scope includes all pending items due on or before the end date, including overdue items.", "Status and owner describe the current saved record, not a historical snapshot on the due date."],
};
const columns: Record<ReportKind, { key: string; label: string }[]> = {
  activity: [ ["visitor_name", "Sales executive"], ["shop_name", "Shop"], ["area", "Area"], ["checked_in_at", "Check in (UAE)"], ["checked_out_at", "Check out (UAE)"], ["lifecycle", "Visit state"], ["outcome", "Outcome"], ["notes", "Visit discussion"], ["order_status", "Order status"], ["order_value", "Order value (AED)"], ["order_note", "Order note"] ].map(([key,label])=>({key,label})),
  duty: [["executive_name", "Sales executive"], ["started_at", "Duty started (UAE)"], ["ended_at", "Duty ended (UAE)"], ["state", "Session state"], ["elapsed_minutes", "Recorded duty minutes"], ["rest_minutes", "Recorded rest minutes"], ["active_minutes", "Duty less rest minutes"], ["rest_history", "Break / return history (UAE)"]].map(([key,label])=>({key,label})),
  followups: [["owner_name", "Assigned executive"], ["shop_name", "Shop"], ["area", "Area"], ["due_date", "Due date (UAE)"], ["status", "Status"], ["created_at", "Created (UAE)"], ["updated_at", "Last updated (UAE)"]].map(([key,label])=>({key,label})),
};
export class Reports {
  constructor(private db: Database, private clock = () => new Date()) {}

  private filters(p: URLSearchParams): Filters {
    const asOf = this.clock().toISOString(), today = businessDay(asOf);
    const from = calendarDate.parse(p.get("from") || today), to = calendarDate.parse(p.get("to") || from);
    if (from > to) throw new Fault(400, "INVALID_RANGE", "The start date must be on or before the end date.");
    if ((+new Date(to) - +new Date(from)) / 86400000 > 366) throw new Fault(422, "RANGE_TOO_LARGE", "Choose a date range of one year or less.");
    const [start, end] = dayRange(from, to);
    return { from, to, start, end, asOf,
      person: p.get("person") ? z.string().uuid().parse(p.get("person")) : null,
      page: z.coerce.number().int().min(0).max(100000).parse(p.get("page") ?? 0),
      pageSize: z.coerce.number().int().min(1).max(100).parse(p.get("pageSize") ?? 40),
      status: z.enum(["pending", "completed", "cancelled", "all"]).parse(p.get("status") || "pending"),
      scope: z.enum(["range", "outstanding"]).parse(p.get("scope") || "range"),
    };
  }
  private async authorize(tx: Queryable, actor: Actor, person: string | null) {
    if (actor.role !== "manager" && actor.role !== "admin") throw new Fault(403, "FORBIDDEN", "Only managers and administrators can view team reports.");
    const current = (await tx.query<Row>("SELECT m.role,u.active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.user_id=$2", [actor.organizationId,actor.id])).rows[0];
    if (!current?.active || current.role !== actor.role) throw new Fault(403, "FORBIDDEN", "Account permissions have changed. Sign in again.");
    if (person && !(await tx.query("SELECT 1 FROM memberships WHERE organization_id=$1 AND user_id=$2 AND role IN ('executive','delivery')", [actor.organizationId,person])).rows.length) throw new Fault(404, "NOT_FOUND", "Staff member not found in this workspace.");
  }
  private metadata(f: Filters) {
    return {from:f.from,to:f.to,person:f.person,timeZone:"Asia/Dubai" as const,asOf:f.asOf,page:f.page,pageSize:f.pageSize};
  }
  private async read(tx: Queryable, actor: Actor, kind: ReportKind, f: Filters, all = false): Promise<ReportPage> {
    const args: unknown[] = [actor.organizationId, f.person, f.start, f.end, f.asOf];
    let source: string;
    if (kind === "activity") source = `SELECT v.*,s.name AS shop_name,s.area,u.name AS visitor_name FROM visits v JOIN shops s ON s.id=v.shop_id AND s.organization_id=v.organization_id JOIN users u ON u.id=v.visitor_id WHERE v.organization_id=$1 AND ($2::uuid IS NULL OR v.visitor_id=$2) AND v.checked_in_at >= $3::timestamptz AND v.checked_in_at < $4::timestamptz AND v.checked_in_at <= $5::timestamptz`;
    else if (kind === "duty") source = `SELECT d.*,u.name AS executive_name, COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'started_at',r.started_at,'ended_at',r.ended_at) ORDER BY r.started_at,r.id) FROM rest_intervals r WHERE r.organization_id=d.organization_id AND r.session_id=d.id),'[]'::jsonb) AS rests FROM duty_sessions d JOIN users u ON u.id=d.executive_id WHERE d.organization_id=$1 AND ($2::uuid IS NULL OR d.executive_id=$2) AND d.started_at < $4::timestamptz AND d.started_at <= $5::timestamptz AND COALESCE(d.ended_at,$5::timestamptz) > $3::timestamptz`;
    else {
      args.push(f.from,f.to,f.status,f.scope);
      source = `SELECT f.id,f.organization_id,f.shop_id,f.visit_id,f.owner_id,f.created_by,f.due_date::text AS due_date,f.status,f.created_at,f.updated_at,f.version,s.name AS shop_name,s.area,u.name AS owner_name FROM followups f JOIN shops s ON s.id=f.shop_id AND s.organization_id=f.organization_id JOIN users u ON u.id=f.owner_id WHERE f.organization_id=$1 AND ($2::uuid IS NULL OR f.owner_id=$2) AND f.created_at <= $5::timestamptz AND f.due_date <= $7::date AND (($9::text='outstanding' AND f.status='pending') OR ($9::text='range' AND f.due_date >= $6::date AND ($8::text='all' OR f.status=$8))) AND $3::timestamptz IS NOT NULL AND $4::timestamptz IS NOT NULL`;
    }
    const total = (await tx.query<{n:number}>(`SELECT count(*)::int AS n FROM (${source}) filtered`, args)).rows[0].n;
    if (all && total > 10000) throw new Fault(422,"EXPORT_TOO_LARGE","This report has more than 10,000 records. Choose fewer dates or one sales executive, then download again.");
    const order = kind === "activity" ? "checked_in_at DESC,id" : kind === "duty" ? "started_at DESC,id" : "due_date,id";
    const rows = (await tx.query<Row>(`${source} ORDER BY ${order} LIMIT $${args.length+1} OFFSET $${args.length+2}`, [...args,all ? 10000 : f.pageSize,all ? 0 : f.page*f.pageSize])).rows;
    if (kind === "duty") for (const row of rows) Object.assign(row,this.dutyDurations(row,f));
    const result: ReportPage = {...this.metadata(f),total,rows};
    if (kind === "followups") Object.assign(result,{status:f.scope === "outstanding" ? "pending" : f.status,scope:f.scope});
    if (kind === "activity") {
      const staff = (await tx.query<Row>(`SELECT u.id,u.name,u.active,
        (SELECT count(*)::int FROM visits v WHERE v.organization_id=m.organization_id AND v.visitor_id=u.id AND v.checked_in_at >= $3::timestamptz AND v.checked_in_at < $4::timestamptz AND v.checked_in_at <= $5::timestamptz) AS checked_in,
        (SELECT count(*)::int FROM visits v WHERE v.organization_id=m.organization_id AND v.visitor_id=u.id AND v.checked_out_at >= $3::timestamptz AND v.checked_out_at < $4::timestamptz AND v.checked_out_at <= $5::timestamptz) AS completed_visits,
        (SELECT count(*)::int FROM visits v WHERE v.organization_id=m.organization_id AND v.visitor_id=u.id AND v.lifecycle='open') AS open_visits,
        (SELECT count(*)::int FROM followups f WHERE f.organization_id=m.organization_id AND f.owner_id=u.id AND f.status='pending') AS pending_followups,
        (SELECT count(*)::int FROM followups f WHERE f.organization_id=m.organization_id AND f.owner_id=u.id AND f.status='pending' AND f.due_date <= $6::date) AS due_followups,
        (SELECT count(*)::int FROM duty_sessions d WHERE d.organization_id=m.organization_id AND d.executive_id=u.id AND d.started_at < $4::timestamptz AND d.started_at <= $5::timestamptz AND COALESCE(d.ended_at,$5::timestamptz)>$3::timestamptz) AS recorded_sessions,
        COALESCE((SELECT CASE WHEN EXISTS(SELECT 1 FROM rest_intervals r WHERE r.organization_id=d.organization_id AND r.session_id=d.id AND r.ended_at IS NULL) THEN 'On break' ELSE 'On duty' END FROM duty_sessions d WHERE d.organization_id=m.organization_id AND d.executive_id=u.id AND d.ended_at IS NULL LIMIT 1),'Off duty') AS duty_status
        FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.role IN ('executive','delivery') AND ($2::uuid IS NULL OR u.id=$2) ORDER BY u.name,u.id`,[...args,f.to])).rows;
      result.staff=staff;
      const sum=(key:string)=>staff.reduce((n,r)=>n+Number(r[key]),0);
      result.summary={executives:staff.length,checked_in:sum("checked_in"),completed_visits:sum("completed_visits"),open_visits:sum("open_visits"),pending_followups:sum("pending_followups"),due_followups:sum("due_followups"),recorded_sessions:sum("recorded_sessions"),on_duty:staff.filter(s=>s.duty_status==="On duty").length,on_break:staff.filter(s=>s.duty_status==="On break").length};
    }
    return result;
  }
  private dutyDurations(row:Row,f:Filters) {
    const start=Math.max(+new Date(row.started_at),+new Date(f.start)), end=Math.min(+new Date(row.ended_at ?? f.asOf),+new Date(f.end),+new Date(f.asOf));
    const intervals=(row.rests as Row[]).map(r=>[Math.max(start,+new Date(r.started_at)),Math.min(end,+new Date(r.ended_at ?? f.asOf))]).filter(([s,e])=>e>s).sort((a,b)=>a[0]-b[0]);
    // Union overlaps defensively; a malformed interval must not double-count rest.
    let rest=0,until=start;
    for(const [s,e] of intervals){rest+=Math.max(0,e-Math.max(s,until));until=Math.max(until,e);}
    const elapsed=Math.max(0,end-start);
    return {state:row.ended_at?"Ended":row.rests.some((r:Row)=>!r.ended_at)?"On break":"On duty",elapsed_minutes:Math.round(elapsed/600)/100,rest_minutes:Math.round(rest/600)/100,active_minutes:Math.round(Math.max(0,elapsed-rest)/600)/100,clipped_from:new Date(start).toISOString(),clipped_to:new Date(Math.max(start,end)).toISOString()};
  }
  private async report(actor:Actor,kind:ReportKind,p:URLSearchParams) {
    const f=this.filters(p);
    return this.db.transaction(async tx=>{await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");await this.authorize(tx,actor,f.person);return this.read(tx,actor,kind,f);});
  }
  activity(actor:Actor,p:URLSearchParams){return this.report(actor,"activity",p);}
  duty(actor:Actor,p:URLSearchParams){return this.report(actor,"duty",p);}
  followups(actor:Actor,p:URLSearchParams){return this.report(actor,"followups",p);}
  async exportRows(actor:Actor,kind:ReportKind,p:URLSearchParams):Promise<ReportExport> {
    z.enum(["activity","duty","followups"]).parse(kind);
    const f=this.filters(p);
    return this.db.transaction(async tx=>{
      await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await this.authorize(tx,actor,f.person);
      const result=await this.read(tx,actor,kind,f,true);
      const personName=f.person?(await tx.query<{name:string}>("SELECT u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=$1 AND u.id=$2 AND m.role IN ('executive','delivery')",[actor.organizationId,f.person])).rows[0].name:null;
      const sum=(key:string)=>Math.round(result.rows.reduce((n,r)=>n+Number(r[key]??0),0)*100)/100;
      const totals=kind==="activity"?`Visits started in dates: ${result.total}. Visits completed in dates: ${result.summary!.completed_visits}. Pending follow-ups now: ${result.summary!.pending_followups}. Due by end date: ${result.summary!.due_followups}.`:kind==="duty"?`Duty sessions: ${result.total}. Recorded duty: ${sum("elapsed_minutes")} min. Rest: ${sum("rest_minutes")} min. Duty less rest: ${sum("active_minutes")} min.`:`Follow-ups: ${result.total}. Pending: ${result.rows.filter(r=>r.status==="pending").length}. Completed: ${result.rows.filter(r=>r.status==="completed").length}. Cancelled: ${result.rows.filter(r=>r.status==="cancelled").length}.`;
      const local=(v:any)=>v?new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Dubai",dateStyle:"short",timeStyle:"short",hour12:false}).format(new Date(v)):"";
      const rows=result.rows.map(row=>{
        const copy={...row};
        for(const key of ["checked_in_at","checked_out_at","started_at","ended_at","created_at","updated_at"]) if(key in copy) copy[key]=local(copy[key]);
        if(kind==="duty")copy.rest_history=row.rests.map((r:Row)=>`${local(r.started_at)} to ${r.ended_at?local(r.ended_at):"Ongoing"}`).join("; ");
        return copy;
      });
      return {kind,title:{activity:"Visit activity",duty:"Recorded duty and breaks",followups:"Customer follow-ups"}[kind],from:f.from,to:f.to,person:f.person,personName,totals,timeZone:"Asia/Dubai",asOf:f.asOf,total:result.total,notes:[...notes[kind],...(kind==="followups"?[`Scope: ${f.scope}; status: ${f.scope==="outstanding"?"pending":f.status}.`]:[])],columns:columns[kind],rows};
    });
  }
}
