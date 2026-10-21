import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { attendanceForRange, formatDuration } from "../demo/attendance.js";
import { DemoStore, STORAGE_KEY } from "../demo/store.js";
import { profiles, type Row, type Source } from "../demo/data.js";

const staff=profiles.slice(0,3), person=staff[0];
const at=(day:string,time:string)=>`${day}T${time}+04:00`;
const session=(id:string,start:string,end:string|null,executive_id=person.id):Row=>({id,executive_id,started_at:start,ended_at:end});
const rest=(id:string,session_id:string,start:string,end:string|null):Row=>({id,session_id,started_at:start,ended_at:end});
const report=(sessions:Row[],rests:Row[]=[],from="2026-10-21",to=from,asOf=at("2026-10-22","12:00:00"),people=staff)=>attendanceForRange(sessions,rests,people,from,to,asOf);

test("Attendance aggregates exact milliseconds before formatting whole minutes",()=>{
  const result=report([
    session("a",at("2026-10-21","09:00:00"),at("2026-10-21","09:00:40")),
    session("b",at("2026-10-21","10:00:00"),at("2026-10-21","10:00:40")),
  ]);
  assert.equal(result.rows[0].duty_ms,80000);
  assert.equal(result.rows[0].net_duration,"0h 1m");
  assert.equal(formatDuration(3599999),"0h 59m");assert.equal(formatDuration(3600000),"1h 0m");
  assert.equal(formatDuration(-1),"0h 0m");
});

test("Attendance combines multiple sessions and two breaks without payroll assumptions",()=>{
  const sessions=[session("a",at("2026-10-21","08:00:00"),at("2026-10-21","12:00:00")),session("b",at("2026-10-21","13:00:00"),at("2026-10-21","17:00:00"))];
  const breaks=[rest("x","a",at("2026-10-21","09:00:00"),at("2026-10-21","09:15:00")),rest("y","a",at("2026-10-21","11:00:00"),at("2026-10-21","11:30:00"))];
  const result=report(sessions,breaks),row=result.rows[0];
  assert.equal(row.duty_duration,"8h 0m");assert.equal(row.break_duration,"0h 45m");assert.equal(row.net_duration,"7h 15m");
  assert.equal(row.recorded_sessions,2);assert.equal(row.sessions[0].rests.length,2);
  assert.equal(row.status,"Duty ended");assert.equal(row.current_status,"Off duty");
  assert.equal(row.first_start,new Date(sessions[0].started_at).toISOString());
  assert.equal(row.last_end,new Date(sessions[1].ended_at).toISOString());
});

test("Attendance clips overnight sessions and breaks at UAE midnight, retaining actual timestamps",()=>{
  const sessions=[session("a",at("2026-10-20","23:00:00"),at("2026-10-21","02:00:00"))],breaks=[rest("r","a",at("2026-10-20","23:45:00"),at("2026-10-21","00:15:00"))];
  const result=report(sessions,breaks,"2026-10-20","2026-10-21"),rows=result.rows.filter(r=>r.executive_id===person.id);
  assert.deepEqual(rows.map(r=>[r.duty_ms,r.break_ms,r.net_ms]),[[3600000,900000,2700000],[7200000,900000,6300000]]);
  assert.equal(rows[0].status,"Duty not ended");assert.equal(rows[1].status,"Duty ended");
  assert.equal(rows[1].first_start,new Date(sessions[0].started_at).toISOString());
  assert.equal(rows[1].sessions[0].started_at,sessions[0].started_at);
  assert.equal(rows[1].sessions[0].clipped_start,"2026-10-20T20:00:00.000Z");
  assert.equal(result.totals.duty_ms,rows.reduce((n,r)=>n+r.duty_ms,0));
  assert.equal(result.totals.net_ms,rows.reduce((n,r)=>n+r.net_ms,0));
});

test("Attendance unions duplicate or overlapping sessions and break intervals defensively",()=>{
  const result=report([session("a",at("2026-10-21","08:00:00"),at("2026-10-21","12:00:00")),session("b",at("2026-10-21","10:00:00"),at("2026-10-21","14:00:00"))],[rest("r1","a",at("2026-10-21","10:00:00"),at("2026-10-21","11:00:00")),rest("r2","b",at("2026-10-21","10:30:00"),at("2026-10-21","11:30:00")),rest("invalid","b",at("2026-10-21","13:00:00"),at("2026-10-21","12:00:00"))]);
  assert.equal(result.rows[0].duty_duration,"6h 0m");assert.equal(result.rows[0].break_duration,"1h 30m");assert.equal(result.rows[0].net_duration,"4h 30m");
  assert.equal(result.rows[0].overlap_detected,true);assert.equal(result.totals.overlap_detected,true);assert.equal(result.totalsByExecutive[0].overlap_detected,true);assert.equal(result.rows[1].overlap_detected,false);
});

test("Attendance derives past status at that date and separates live status",()=>{
  const sessions=[session("past",at("2026-10-20","08:00:00"),at("2026-10-20","12:00:00")),session("now",at("2026-10-21","09:00:00"),null)],breaks=[rest("now-break","now",at("2026-10-21","10:00:00"),null)];
  const historical=report(sessions,breaks,"2026-10-20","2026-10-20",at("2026-10-21","11:00:00"));
  assert.equal(historical.rows[0].status,"Duty ended");assert.equal(historical.rows[0].current_status,"On break");assert.equal(historical.rows[0].duty_duration,"4h 0m");
  const live=report(sessions,breaks,"2026-10-21","2026-10-21",at("2026-10-21","11:00:00"));
  assert.equal(live.rows[0].status,"On break");assert.equal(live.rows[0].duty_duration,"2h 0m");assert.equal(live.rows[0].break_duration,"1h 0m");assert.equal(live.rows[0].last_end,null);
});

test("Attendance caps ongoing history at the selected date, excludes future and no-record staff",()=>{
  const sessions=[session("open",at("2026-10-20","23:00:00"),null)];
  const past=report(sessions,[],"2026-10-20","2026-10-20",at("2026-10-22","11:00:00"));
  assert.equal(past.rows[0].duty_ms,3600000);assert.equal(past.rows[0].status,"Duty not ended");assert.equal(past.rows[0].current_status,"On duty");
  assert.equal(past.rows[1].status,"No duty recorded");assert.equal(past.rows[1].duty_ms,0);
  const future=report(sessions,[],"2026-10-23","2026-10-23",at("2026-10-22","11:00:00"));
  assert.ok(future.rows.every(r=>r.status==="No duty recorded"&&r.duty_ms===0));
});

test("Attendance midnight boundaries never allocate a new session to the preceding day",()=>{
  const midnight=at("2026-10-21","00:00:00"),sessions=[session("new",midnight,null)];
  const result=report(sessions,[],"2026-10-20","2026-10-21",midnight);
  assert.equal(result.rows[0].status,"No duty recorded");
  const today=result.rows.find(r=>r.date==="2026-10-21"&&r.executive_id===person.id)!;
  assert.equal(today.status,"On duty");assert.equal(today.duty_ms,0);assert.equal(today.recorded_sessions,1);
});

test("Attendance ending exactly at midnight is ended without including the next day's new session",()=>{
  const midnight=at("2026-10-21","00:00:00"),sessions=[session("finished",at("2026-10-20","23:00:00"),midnight),session("next-day",midnight,null)];
  const result=report(sessions,[],"2026-10-20","2026-10-21",at("2026-10-21","01:00:00"));
  const previous=result.rows.find(r=>r.date==="2026-10-20"&&r.executive_id===person.id)!;
  assert.equal(previous.status,"Duty ended");assert.equal(previous.sessions[0].state,"Ended");assert.equal(previous.recorded_sessions,1);assert.equal(previous.duty_ms,3600000);
  assert.equal(previous.last_end,new Date(midnight).toISOString());assert.equal(previous.current_status,"On duty");
  const today=result.rows.find(r=>r.date==="2026-10-21"&&r.executive_id===person.id)!;
  assert.equal(today.status,"On duty");assert.equal(today.recorded_sessions,1);assert.equal(today.sessions[0].id,"next-day");
  const withoutNewSession=report([sessions[0]],[],"2026-10-21","2026-10-21",at("2026-10-21","01:00:00"));
  assert.equal(withoutNewSession.rows[0].status,"No duty recorded");
});

test("Attendance ignores malformed/reversed intervals instead of producing negative or NaN hours",()=>{
  const result=report([session("bad","bad",null),session("reverse",at("2026-10-21","12:00:00"),at("2026-10-21","09:00:00")),session("good",at("2026-10-21","08:00:00"),at("2026-10-21","10:00:00"))],[rest("outside","good",at("2026-10-21","06:00:00"),at("2026-10-21","08:30:00")),rest("bad","good","invalid",null)]);
  assert.equal(result.rows[0].duty_duration,"2h 0m");assert.equal(result.rows[0].break_duration,"0h 30m");assert.equal(result.rows[0].net_duration,"1h 30m");
});

test("Attendance per-person, daily and all-staff totals reconcile with completed visit dates",()=>{
  const sessions=[session("one",at("2026-10-20","23:00:00"),at("2026-10-21","01:00:00")),session("two",at("2026-10-21","08:00:00"),at("2026-10-21","10:00:00"),staff[1].id)];
  const visits=[{visitor_id:person.id,lifecycle:"completed",checked_in_at:at("2026-10-20","23:30:00"),checked_out_at:at("2026-10-21","00:00:00")},{visitor_id:staff[1].id,lifecycle:"completed",checked_out_at:at("2026-10-21","10:00:00")},{visitor_id:staff[1].id,lifecycle:"open",checked_out_at:null}];
  const result=attendanceForRange(sessions,[],staff,"2026-10-20","2026-10-21",at("2026-10-21","12:00:00"),visits);
  assert.equal(result.totals.duty_ms,4*3600000);assert.equal(result.totals.completed_visits,2);
  for(const key of ["duty_ms","break_ms","net_ms","completed_visits"]){
    assert.equal(result.totals[key as keyof typeof result.totals],result.rows.reduce((n,r)=>n+r[key],0));
    assert.equal(result.totals[key as keyof typeof result.totals],result.totalsByExecutive.reduce((n,r)=>n+r[key],0));
  }
  assert.equal(result.rows.find(r=>r.date==="2026-10-20"&&r.executive_id===person.id)!.completed_visits,0);
  assert.equal(result.rows.find(r=>r.date==="2026-10-21"&&r.executive_id===person.id)!.completed_visits,1);
  const selected=attendanceForRange(sessions,[],[staff[1]],"2026-10-20","2026-10-21",at("2026-10-21","12:00:00"),visits);
  assert.equal(selected.totals.duty_ms,2*3600000);assert.equal(selected.totals.completed_visits,1);
});

test("Demo duty, manager activity and attendance reports reconcile across roles and refresh",async()=>{
  const source:Source=JSON.parse(await readFile(new URL("../fixtures/reference-synthetic.json",import.meta.url),"utf8"));
  const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
  let now=new Date(at("2026-10-21","08:00:00"));
  const store=new DemoStore(storage,source,()=>now);store.select(person.id);
  const saved=JSON.parse(values.get(STORAGE_KEY)!);saved.sessions=[];saved.rests=[];values.set(STORAGE_KEY,JSON.stringify(saved));
  const duty=store.request("/duty/start",{expectedSessionId:null},"start");now=new Date(at("2026-10-21","09:00:00"));store.request("/duty/rest",{expectedSessionId:duty.sessionId},"rest");now=new Date(at("2026-10-21","09:15:00"));store.request("/duty/return",{expectedSessionId:duty.sessionId},"return");now=new Date(at("2026-10-21","10:00:00"));store.request("/duty/end",{expectedSessionId:duty.sessionId},"end");
  const executive=store.request("/duty");assert.equal(executive.today.net_duration,"1h 45m");assert.equal(executive.sessions[0].duty_ms,7200000);
  store.select(profiles[3].id);
  const fresh=new DemoStore(storage,source,()=>now),params=new URLSearchParams({from:"2026-10-21",to:"2026-10-21",person:person.id});
  const attendance=fresh.report("attendance",params,true),activity=fresh.report("activity",params),legacy=fresh.report("duty",params);
  assert.equal(attendance.rows.length,1);assert.equal(attendance.summary.net_ms,executive.today.net_ms);assert.equal(activity.staff[0].net_ms,attendance.summary.net_ms);assert.equal(activity.summary.net_ms,attendance.summary.net_ms);
  assert.equal(legacy.rows[0].elapsed_minutes*60000,attendance.summary.duty_ms);assert.equal(legacy.summary.net_ms,attendance.summary.net_ms);assert.equal(attendance.sessions[0].rests.length,1);
  assert.equal(fresh.report("attendance",new URLSearchParams({from:"2026-10-21"})).rows.length,4);
  fresh.reset();fresh.select(profiles[3].id);assert.equal(fresh.report("attendance",params).rows[0].status,"No duty recorded");
});
