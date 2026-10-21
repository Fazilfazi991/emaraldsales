import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {DemoStore,STORAGE_KEY} from "../demo/store.js";
import {profiles,id,createData,type Source} from "../demo/data.js";
import {demoReport} from "../demo/reports.js";
const source:Source=JSON.parse(await readFile(new URL("../fixtures/reference-synthetic.json",import.meta.url),"utf8"));
function fixture(){
  const values=new Map<string,string>();let full=false;
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(full)throw new Error("quota");values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const store=new DemoStore(storage,source,()=>new Date("2026-10-21T12:00:00Z"));
  return {store,storage,values,fill:()=>{full=true;},post:(path:string,body:any,key=randomUUID())=>store.request(path,body,key)};
}
test("Demo seeds 700 deterministic fictional shops and selects a role without credentials",()=>{
  assert.deepEqual(createData(source,new Date("2026-10-21T12:00:00Z")),createData(source,new Date("2026-10-21T12:00:00Z")));
  const f=fixture();assert.throws(()=>f.store.request("/me"),/Choose a demo role/);f.store.select(profiles[0].id);
  assert.equal(f.store.request("/shops").total,700);assert.equal(f.store.request("/me").actor.name,"Ahmed Hassan");
  const fresh=new DemoStore(f.storage,source);assert.equal(fresh.request("/me").actor.id,profiles[0].id);
  assert.doesNotMatch(f.values.get(STORAGE_KEY)!,/password|DATABASE_URL|access_token/);
});
test("Demo initial breaks remain chronological just after UAE midnight",()=>{
  const now=new Date("2026-10-20T20:01:00Z"),data=createData(source,now);
  for(const rest of data.rests){assert.ok(+new Date(rest.started_at)<=+now);if(rest.ended_at)assert.ok(rest.started_at<=rest.ended_at&&+new Date(rest.ended_at)<=+now);}
});
test("Demo complete executive day, follow-up lifecycle, fresh role and manager reports share saved state",()=>{
  const f=fixture();f.store.select(profiles[0].id);
  const duty=f.post("/duty/start",{expectedSessionId:null});
  const visit=f.post("/checkin",{shopId:id(1000),location:{availability:"not_requested"}}).visit;
  f.post(`/visits/${visit.id}/checkout`,{outcome:"Follow-up Required",notes:"Sample discussion",orderStatus:"No Order",followUpDate:"2026-10-22"});
  const profile=f.store.request(`/shops/${id(1000)}`),follow=profile.followups.find((x:any)=>x.visit_id===visit.id);
  f.post(`/followups/${follow.id}`,{action:"reschedule",dueDate:"2026-10-23",reason:"Sample request",version:1});
  f.post(`/followups/${follow.id}`,{action:"complete",reason:"Sample call completed",version:2});
  f.post("/duty/rest",{expectedSessionId:duty.sessionId});f.post("/duty/return",{expectedSessionId:duty.sessionId});f.post("/duty/end",{expectedSessionId:duty.sessionId});
  f.post("/logout",{});f.store.select(profiles[3].id);
  const report=f.store.report("activity",new URLSearchParams({from:"2026-10-21",to:"2026-10-21",person:profiles[0].id}));
  assert.ok(report.rows.some((v:any)=>v.id===visit.id));assert.equal(report.staff[0].duty_status,"Off duty");
  assert.equal(f.store.request(`/shops/${id(1000)}`).followups.find((x:any)=>x.id===follow.id).status,"completed");
  assert.ok(f.store.report("duty",new URLSearchParams({from:"2026-10-21",to:"2026-10-21",person:profiles[0].id})).rows[0].rests.length===1);
});
test("Demo retries are idempotent, one visit stays active, and failed checkout is atomic",()=>{
  const f=fixture();f.store.select(profiles[0].id);const body={shopId:id(1000),location:{availability:"not_requested"}},key=randomUUID();
  const v=f.post("/checkin",body,key);assert.deepEqual(f.post("/checkin",body,key),v);
  assert.throws(()=>f.post("/checkin",{...body,shopId:id(1001)},key),/different action/);
  assert.throws(()=>f.post("/checkin",{...body,shopId:id(1001)}),/Finish your current visit/);
  assert.throws(()=>f.post(`/visits/${v.visit.id}/checkout`,{outcome:"Regular Visit",notes:"Sample",orderStatus:"No Order",followUpDate:"2020-01-01"}),/future UAE date/);
  assert.equal(f.store.request(`/shops/${id(1000)}`).visits.find((x:any)=>x.id===v.visit.id).lifecycle,"open");
  const done={outcome:"Regular Visit",notes:"Sample",orderStatus:"No Order"},checkoutKey=randomUUID();
  f.post(`/visits/${v.visit.id}/checkout`,done,checkoutKey);f.post(`/visits/${v.visit.id}/checkout`,done,checkoutKey);
  assert.throws(()=>f.post(`/visits/${v.visit.id}/checkout`,done),/already complete/);
});
test("Demo multiple executives share a shop without changing assignment or overwriting another visit",()=>{
  const f=fixture();f.store.select(profiles[0].id);const first=f.post("/checkin",{shopId:id(1000),location:{availability:"not_requested"}}).visit;
  const owner=f.store.request(`/shops/${id(1000)}`).shop.assigned_executive_id;
  f.store.select(profiles[1].id);const second=f.post("/checkin",{shopId:id(1000),location:{availability:"not_requested"}}).visit;
  assert.notEqual(second.id,first.id);
  assert.throws(()=>f.post(`/visits/${first.id}/checkout`,{outcome:"Regular Visit",notes:"Sample",orderStatus:"No Order"}),/another executive/);
  assert.equal(f.store.request(`/shops/${id(1000)}`).shop.assigned_executive_id,owner);
  f.store.select(profiles[3].id);assert.throws(()=>f.post("/duty/start",{expectedSessionId:null}),/Only executives/);
});
test("Demo repeated visits retain existing follow-ups and stale reschedules fail",()=>{
  const f=fixture();f.store.select(profiles[0].id);const shop=id(1000),before=f.store.request(`/shops/${shop}`).followups;
  const v=f.post("/checkin",{shopId:shop,location:{availability:"not_requested"}}).visit;
  f.post(`/visits/${v.id}/checkout`,{outcome:"Regular Visit",notes:"Another sample visit",orderStatus:"No Order"});
  assert.deepEqual(f.store.request(`/shops/${shop}`).followups,before);
  const follow=f.post("/followups",{visitId:v.id,dueDate:"2026-10-22"}).followup;
  f.post(`/followups/${follow.id}`,{action:"reschedule",dueDate:"2026-10-23",reason:"Sample request",version:1});
  assert.throws(()=>f.post(`/followups/${follow.id}`,{action:"reschedule",dueDate:"2026-10-24",reason:"Stale sample",version:1}),/record changed/);
});
test("Demo transfers are explicit, versioned and recorded without changing follow-up owners",()=>{
  const f=fixture();f.store.select(profiles[3].id);const before=f.store.request(`/shops/${id(1000)}`);
  f.post(`/shops/${id(1000)}/transfer`,{version:1,assignedExecutiveId:profiles[1].id,reason:"Sample territory transfer"});
  const after=f.store.request(`/shops/${id(1000)}`);assert.equal(after.shop.assigned_executive_id,profiles[1].id);assert.deepEqual(after.followups,before.followups);
  assert.equal(f.store.request(`/shops/${id(1000)}/audit`).rows[0].details.reason,"Sample territory transfer");
});
test("Demo report dates, staff filters, Unicode names and overnight duty totals agree",()=>{
  const f=fixture();f.store.select(profiles[3].id);
  const report=demoReport(f.store,"/reports/activity/export?from=2026-10-21&to=2026-10-21&format=xlsx");
  assert.ok(report.rows.some((r:any)=>r.shop_name.includes("مؤسسة")));assert.ok(report.rows.some((r:any)=>r.shop_name.includes("മാതൃക")));
  assert.equal(report.total,6);assert.throws(()=>f.store.report("activity",new URLSearchParams({from:"2026-10-22",to:"2026-10-21"})),/start date/);
  const state=JSON.parse(f.values.get(STORAGE_KEY)!);state.sessions.push({id:randomUUID(),executive_id:profiles[0].id,started_at:"2026-10-20T22:00:00Z",ended_at:"2026-10-21T02:00:00Z"});f.storage.setItem(STORAGE_KEY,JSON.stringify(state));
  const duty=f.store.report("duty",new URLSearchParams({from:"2026-10-21",to:"2026-10-21",person:profiles[0].id}));assert.equal(duty.rows[0].elapsed_minutes,240);
});
test("Demo storage failures preserve the last saved state, corruption is not silently erased, reset is scoped",()=>{
  const f=fixture();f.values.set("other-app","preserve");f.store.select(profiles[0].id);const before=f.values.get(STORAGE_KEY);f.fill();
  assert.throws(()=>f.post("/duty/start",{expectedSessionId:null}),/could not save/);assert.equal(f.values.get(STORAGE_KEY),before);
  f.values.set(STORAGE_KEY,"bad json");assert.throws(()=>f.store.request("/me"),/Reset Demo Data/);assert.equal(f.values.get(STORAGE_KEY),"bad json");
  f.store.reset();assert.equal(f.values.get("other-app"),"preserve");assert.equal(f.values.has(STORAGE_KEY),false);
});
