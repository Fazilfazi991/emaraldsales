import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate } from "../src/database.js";
import { Reports } from "../src/reports.js";
import { type Actor, Fault } from "../src/domain.js";

test("Manager reports: saved activity, UAE dates, ongoing duty and complete exports", async t=>{
  const db=await openDatabase();await migrate(db);
  const org=randomUUID(),foreignOrg=randomUUID(),shop=randomUUID();
  const user=async(name:string,role:Actor["role"],organizationId=org):Promise<Actor>=>{
    const id=randomUUID();await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,'test-only-unused')",[id,`${id}@local.invalid`,name]);
    await db.query("INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,$3)",[organizationId,id,role]);
    return {id,name,role,organizationId};
  };
  await db.query("INSERT INTO organizations(id,name) VALUES($1,'Report test'),($2,'Foreign report test')",[org,foreignOrg]);
  const manager=await user("Manager","manager"),admin=await user("Admin","admin"),ahmed=await user("Ahmed","executive"),naseer=await user("Naseer","executive"),foreign=await user("Foreign executive","executive",foreignOrg);
  await db.query("INSERT INTO shops(id,organization_id,name,area,status,assigned_executive_id,created_by) VALUES($1,$2,'Test shop','Dubai','Customer',$3,$3)",[shop,org,ahmed.id]);
  const visit=async(start:string,end:string|null,owner=ahmed.id)=>{
    const id=randomUUID();await db.query(`INSERT INTO visits(id,organization_id,shop_id,visitor_id,created_by,checked_in_at,checked_out_at,lifecycle,outcome,notes,location) VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,'Saved visit','{"availability":"not_requested"}')`,[id,org,shop,owner,start,end,end?"completed":"open",end?"Regular Visit":null]);return id;
  };
  const before=await visit("2026-01-19T19:59:59Z","2026-01-19T20:10:00Z");
  await visit("2026-01-19T20:00:00Z","2026-01-19T20:20:00Z");
  await visit("2026-01-20T20:00:00Z","2026-01-20T20:01:00Z");
  await visit("2026-01-20T04:00:00Z",null,naseer.id);
  for(let i=0;i<45;i++)await visit("2026-01-20T05:00:00Z","2026-01-20T05:10:00Z");
  const now=new Date("2026-01-20T08:00:00Z"), reports=new Reports(db,()=>now);
  const params=(extra="")=>new URLSearchParams(`from=2026-01-20&to=2026-01-20${extra}`);
  try{
    await t.test("executive denied, inactive manager denied and foreign executive filter hidden",async()=>{
      for(const fn of [reports.activity.bind(reports),reports.duty.bind(reports),reports.followups.bind(reports)])await assert.rejects(()=>fn(ahmed,params()),(e:Fault)=>e.status===403);
      await assert.rejects(()=>reports.exportRows(ahmed,"activity",params()),(e:Fault)=>e.status===403);
      await assert.rejects(()=>reports.activity(manager,params(`&person=${foreign.id}`)),(e:Fault)=>e.status===404);
      await db.query("UPDATE users SET active=false WHERE id=$1",[manager.id]);
      await assert.rejects(()=>reports.activity(manager,params()),(e:Fault)=>e.status===403);
      await db.query("UPDATE users SET active=true WHERE id=$1",[manager.id]);
      assert.equal((await reports.activity(admin,params())).total,47);
    });
    await t.test("UAE exclusive end, checkout totals include overnight starts, pages preserve totals",async()=>{
      const result=await reports.activity(manager,params());
      assert.equal(result.total,47);assert.equal(result.rows.length,40);assert.equal(result.summary!.checked_in,47);
      assert.equal(result.summary!.completed_visits,47);assert.equal(result.summary!.open_visits,1);
      assert.equal(result.staff!.find(s=>s.id===ahmed.id)!.checked_in,46);
      assert.equal((await reports.activity(manager,params("&page=1"))).rows.length,7);
      assert.equal((await reports.activity(manager,params(`&person=${naseer.id}`))).total,1);
      const preceding=await reports.activity(manager,new URLSearchParams("from=2026-01-19&to=2026-01-19"));
      assert.equal(preceding.total,1);assert.equal(preceding.rows[0].id,before);
    });
    await t.test("invalid dates, ranges and page sizes fail explicitly",async()=>{
      await assert.rejects(()=>reports.activity(manager,new URLSearchParams("from=2026-02-30")));
      await assert.rejects(()=>reports.activity(manager,new URLSearchParams("from=2026-01-21&to=2026-01-20")),(e:Fault)=>e.status===400);
      await assert.rejects(()=>reports.activity(manager,new URLSearchParams("from=2024-01-01&to=2026-01-20")),(e:Fault)=>e.status===422);
      await assert.rejects(()=>reports.activity(manager,params("&pageSize=10001")));
      await assert.rejects(()=>reports.activity(manager,params("&person=spoofed")));
    });
    await t.test("overnight and repeated breaks clip correctly; ongoing totals stop at asOf",async()=>{
      const overnight=randomUUID(),ongoing=randomUUID();
      await db.query("INSERT INTO duty_sessions(id,organization_id,executive_id,started_at,ended_at) VALUES($1,$2,$3,'2026-01-19T19:50Z','2026-01-19T20:30Z'),($4,$2,$5,'2026-01-20T06:00Z',NULL)",[overnight,org,ahmed.id,ongoing,naseer.id]);
      for(const [session,start,end] of [[overnight,"2026-01-19T19:55Z","2026-01-19T20:05Z"],[overnight,"2026-01-19T20:10Z","2026-01-19T20:20Z"],[ongoing,"2026-01-20T07:00Z",null]])await db.query("INSERT INTO rest_intervals(id,organization_id,session_id,started_at,ended_at) VALUES($1,$2,$3,$4,$5)",[randomUUID(),org,session,start,end]);
      const result=await reports.duty(manager,params()),night=result.rows.find(r=>r.id===overnight)!,live=result.rows.find(r=>r.id===ongoing)!;
      assert.equal(result.total,2);assert.equal(night.elapsed_minutes,30);assert.equal(night.rest_minutes,15);assert.equal(night.active_minutes,15);assert.equal(night.rests.length,2);
      assert.equal(live.elapsed_minutes,120);assert.equal(live.rest_minutes,60);assert.equal(live.state,"On break");assert.equal(live.clipped_to,now.toISOString());
      const overview=await reports.activity(manager,params());assert.equal(overview.summary!.recorded_sessions,2);assert.equal(overview.staff!.find(s=>s.id===naseer.id)!.duty_status,"On break");
      const prior=await reports.duty(manager,new URLSearchParams("from=2026-01-19&to=2026-01-19"));assert.equal(prior.rows[0].elapsed_minutes,10);assert.equal(prior.rows[0].rest_minutes,5);
    });
    await t.test("follow-up monitoring preserves lifecycle and includes overdue explicitly",async()=>{
      for(const [due,status,owner] of [["2026-01-01","pending",ahmed.id],["2026-01-20","pending",naseer.id],["2026-01-21","pending",ahmed.id],["2026-01-20","completed",ahmed.id],["2026-01-20","cancelled",ahmed.id]])await db.query("INSERT INTO followups(id,organization_id,shop_id,visit_id,owner_id,created_by,due_date,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$5,$6,$7,'2026-01-01T00:00Z','2026-01-01T00:00Z')",[randomUUID(),org,shop,before,owner,due,status]);
      const range=await reports.followups(manager,params());assert.equal(range.total,1);assert.equal(range.rows[0].due_date,"2026-01-20");
      const outstanding=await reports.followups(manager,params("&scope=outstanding"));assert.equal(outstanding.total,2);assert.equal(outstanding.rows[0].due_date,"2026-01-01");
      assert.equal((await reports.followups(manager,params("&status=all"))).total,3);
      assert.equal((await reports.followups(manager,params(`&scope=outstanding&person=${ahmed.id}`))).total,1);
      const overview=await reports.activity(manager,params());assert.equal(overview.summary!.pending_followups,3);assert.equal(overview.summary!.due_followups,2);
    });
    await t.test("exports include every matching row rather than page, UAE labels and duty history",async()=>{
      const result=await reports.exportRows(manager,"activity",params("&page=1&pageSize=1"));assert.equal(result.total,47);assert.equal(result.rows.length,47);
      assert.equal(result.rows.filter(v=>v.checked_in_at==="20/01/2026, 09:00").length,45);assert.equal(result.timeZone,"Asia/Dubai");
      const duty=await reports.exportRows(manager,"duty",params());assert.equal(duty.rows.length,2);assert.ok(duty.rows.some(d=>d.rest_history.includes("Ongoing")));
      const follows=await reports.exportRows(manager,"followups",params("&scope=outstanding"));assert.equal(follows.rows.length,2);assert.ok(follows.notes.some(n=>n.includes("outstanding")));
    });
    await t.test("export cap rejects instead of silently truncating and foreign organization has no rows",async()=>{
      await db.query(`INSERT INTO visits(id,organization_id,shop_id,visitor_id,created_by,checked_in_at,checked_out_at,lifecycle,outcome,notes,location) SELECT ('20000000-0000-4000-a000-'||lpad(n::text,12,'0'))::uuid,$1,$2,$3,$3,'2026-01-20T05:00Z','2026-01-20T05:01Z','completed','Regular Visit','Bulk synthetic export cap','{"availability":"not_requested"}'::jsonb FROM generate_series(1,10000) AS n`,[org,shop,ahmed.id]);
      await assert.rejects(()=>reports.exportRows(manager,"activity",params()),(e:Fault)=>e.status===422&&e.code==="EXPORT_TOO_LARGE");
      const foreignManager=await user("Foreign manager","manager",foreignOrg);
      assert.equal((await reports.activity(foreignManager,params())).total,0);assert.equal((await reports.duty(foreignManager,params())).total,0);assert.equal((await reports.followups(foreignManager,params("&scope=outstanding"))).total,0);
    });
  }finally{await db.close();}
});
