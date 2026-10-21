import { addDays, businessDay, calendarDate, dayRange } from "../src/domain.js";
import type { Row } from "./data.js";

type Interval = [number, number];
const instant = (value: unknown): number => typeof value === "string" || value instanceof Date ? +new Date(value) : NaN;
const iso = (value: number) => new Date(value).toISOString();

/** Display only whole aggregate minutes; calculation always keeps exact milliseconds. */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function union(intervals: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const [start, end] of intervals.filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).sort((a,b) => a[0]-b[0])) {
    const previous = result.at(-1);
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else result.push([start, end]);
  }
  return result;
}
const duration = (intervals: Interval[]) => union(intervals).reduce((total,[start,end]) => total + end-start, 0);
const formatted = (duty_ms:number, break_ms:number) => ({duty_ms,break_ms,net_ms:Math.max(0,duty_ms-break_ms),duty_duration:formatDuration(duty_ms),break_duration:formatDuration(break_ms),net_duration:formatDuration(Math.max(0,duty_ms-break_ms))});

/** Browser-local attendance from saved timestamps, clipped to UAE business dates. */
export function attendanceForRange(sessions: Row[], rests: Row[], profiles: Row[], from: string, to: string, asOf: Date | string, visits: Row[] = [], includeDays = true) {
  calendarDate.parse(from); calendarDate.parse(to);
  const at = instant(asOf);
  if (!Number.isFinite(at) || from > to || includeDays && (+new Date(to)-+new Date(from))/86400000 > 366) throw new Error("Choose a valid attendance date range and time.");
  const [rangeStart, rangeEnd] = dayRange(from,to), start = instant(rangeStart), end = Math.min(instant(rangeEnd),at);
  const executives = profiles.filter(person => person.role === "executive");
  const valid = sessions.filter(s => Number.isFinite(instant(s.started_at)) && (!s.ended_at || Number.isFinite(instant(s.ended_at)) && instant(s.ended_at)>=instant(s.started_at)));
  const activeAt = (personId:string, cutoff:number) => valid.filter(s => s.executive_id === personId && instant(s.started_at)<=cutoff && (!s.ended_at || instant(s.ended_at)>cutoff));
  const onBreak = (active:Row[], cutoff:number) => rests.some(r => (!r.ended_at || instant(r.ended_at)>=instant(r.started_at)) && active.some(s=>s.id===r.session_id) && instant(r.started_at)<=cutoff && (!r.ended_at || instant(r.ended_at)>cutoff));
  const currentStatus = (personId:string) => { const active=activeAt(personId,at);return !active.length?"Off duty":onBreak(active,at)?"On break":"On duty"; };
  const details = (person:Row, lo:number, hi:number, upper:number): Row[] => valid.filter(s => s.executive_id===person.id && instant(s.started_at)<=hi && instant(s.started_at)<upper && (!s.ended_at || instant(s.ended_at)>lo || instant(s.ended_at)===instant(s.started_at) && instant(s.started_at)>=lo)).flatMap(s => {
    const low=Math.max(lo,instant(s.started_at)), high=Math.min(hi,s.ended_at?instant(s.ended_at):at,at);
    if(high<low)return [];
    const intervals=rests.filter(r=>r.session_id===s.id).flatMap(r=>{
      const a=Math.max(low,instant(r.started_at)),b=Math.min(high,r.ended_at?instant(r.ended_at):at);
      if(!Number.isFinite(a)||!Number.isFinite(b)||b<a||r.ended_at&&instant(r.ended_at)<instant(r.started_at))return [];
      return [{...r,clipped_start:iso(a),clipped_end:iso(b),break_ms:b-a}];
    });
    const duty=high-low,rest=duration(intervals.map(r=>[instant(r.clipped_start),instant(r.clipped_end)]));
    // Starts belong to a half-open business day; an end exactly at midnight is
    // nevertheless a recorded end for the preceding day's final status.
    const probe=hi,active=instant(s.started_at)<upper&&instant(s.started_at)<=probe&&(!s.ended_at||instant(s.ended_at)>probe);
    return [{...s,executive_name:person.name,clipped_start:iso(low),clipped_end:iso(high),...formatted(duty,rest),rests:intervals,state:!active?"Ended":onBreak([s],probe)?"On break":"On duty"}];
  });
  const summarize = (person:Row, lo:number, hi:number, upper:number, date?:string):Row => {
    const selected=hi>=lo?details(person,lo,hi,upper):[],duty=duration(selected.map(s=>[instant(s.clipped_start),instant(s.clipped_end)])),rest=duration(selected.flatMap(s=>s.rests.map((r:Row)=>[instant(r.clipped_start),instant(r.clipped_end)] as Interval)));
    const probe=hi,active=selected.filter(s=>instant(s.started_at)<upper&&instant(s.started_at)<=probe&&(!s.ended_at||instant(s.ended_at)>probe));
    const historical=upper<=at;
    const ends=selected.filter(s=>s.ended_at&&instant(s.ended_at)<=hi&&instant(s.ended_at)>=lo).map(s=>instant(s.ended_at));
    return {executive_id:person.id,executive_name:person.name,...(date?{date}:{}),first_start:selected.length?iso(Math.min(...selected.map(s=>instant(s.started_at)))):null,clipped_first_start:selected.length?iso(Math.min(...selected.map(s=>instant(s.clipped_start)))):null,last_end:ends.length?iso(Math.max(...ends)):null,
      status:!selected.length?"No duty recorded":active.length?(historical?"Duty not ended":onBreak(active,probe)?"On break":"On duty"):"Duty ended",current_status:currentStatus(person.id),...formatted(duty,rest),overlap_detected:selected.reduce((n,s)=>n+s.duty_ms,0)>duty,recorded_sessions:selected.length,completed_visits:visits.filter(v=>v.visitor_id===person.id&&v.lifecycle==="completed"&&v.checked_out_at&&instant(v.checked_out_at)>=lo&&instant(v.checked_out_at)<instant(date?dayRange(date,date)[1]:rangeEnd)&&instant(v.checked_out_at)<=hi).length,sessions:selected};
  };
  const rows:Row[]=[];
  for(let day=from;includeDays&&day<=to;day=addDays(day,1)) {
    const [lo,hi]=dayRange(day,day);
    for(const person of executives)rows.push(summarize(person,instant(lo),Math.min(instant(hi),at),instant(hi),day));
  }
  const totalsByExecutive=executives.map(person=>summarize(person,start,end,instant(rangeEnd)));
  const totals={duty_ms:totalsByExecutive.reduce((n,r)=>n+r.duty_ms,0),break_ms:totalsByExecutive.reduce((n,r)=>n+r.break_ms,0),net_ms:totalsByExecutive.reduce((n,r)=>n+r.net_ms,0),completed_visits:totalsByExecutive.reduce((n,r)=>n+r.completed_visits,0),overlap_detected:totalsByExecutive.some(r=>r.overlap_detected)};
  return {rows,totalsByExecutive,sessions:totalsByExecutive.flatMap(r=>r.sessions),totals:{...totals,duty_duration:formatDuration(totals.duty_ms),break_duration:formatDuration(totals.break_ms),net_duration:formatDuration(totals.net_ms)},from,to,asOf:iso(at),timeZone:"Asia/Dubai",today:businessDay(iso(at))};
}
