import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, migrate, type Database, type Queryable } from "../src/database.js";
import { seedSynthetic, syntheticId } from "../src/fixtures.js";
import { application } from "../src/server.js";
import { businessDay } from "../src/domain.js";
import type { Config } from "../src/config.js";

// Independent black-box acceptance. The only injected fault is below the service,
// after its transaction callback has run: no implementation fault endpoint exists.
test("Phase 2 independent acceptance: HTTP, isolation, write rollback and disk restart", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emerald-phase2-qa-"));
  const dataPath = join(directory, "database");
  let db = await openDatabase(dataPath);
  await migrate(db);
  const fixture = await seedSynthetic(db, 700);
  let failCommit = false;
  const wrapped: Database = {
    query: ((sql: string, params?: unknown[]) => db.query(sql, params)) as Queryable["query"],
    transaction: (work) => db.transaction(async tx => {
      const result = await work(tx);
      if (failCommit) { failCommit = false; throw new Error("QA synthetic transaction failure before commit"); }
      return result;
    }),
    close: async () => {},
  };
  const settings: Config = {host:"127.0.0.1",port:0,origin:"http://127.0.0.1",dataDir:directory,secure:false,visitPolicy:"approved-v2",dutyPolicy:"approved-v1"};
  let server = application(wrapped, settings);
  async function listen(){await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));settings.origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;}
  const stop = () => new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await listen();
  type Auth = {id:string;cookie:string;csrf:string};
  async function request(path:string, auth?:Auth, body?:unknown, key=randomUUID(), extra:Record<string,string>={}) {
    const response=await fetch(`${settings.origin}/api${path}`,{method:body===undefined?"GET":"POST",headers:{Origin:settings.origin,...(auth?{Cookie:auth.cookie,"X-CSRF-Token":auth.csrf}:{}),...(body===undefined?{}:{"Content-Type":"application/json","Idempotency-Key":key}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
    const bytes=Buffer.from(await response.arrayBuffer());
    let data:any;try{data=JSON.parse(bytes.toString());}catch{data=undefined;}
    return {status:response.status,data,bytes,headers:response.headers};
  }
  async function login(slug:string):Promise<Auth>{const a=fixture.accounts.find(a=>a.email===`${slug}@local.invalid`)!;const r=await request("/login",undefined,{email:a.email,password:a.password});assert.equal(r.status,200);return{id:a.id,cookie:r.headers.get("set-cookie")!.split(";")[0],csrf:r.data.csrf};}
  const exec=await login("ahmed"), second=await login("naseer"), manager=await login("manager");
  const shop=syntheticId("shop-1"), other=syntheticId("shop-2");
  const location={availability:"not_requested"};
  const body={outcome:"Regular Visit",notes:"Independent QA customer discussion",orderStatus:"No Order",followUpDate:null};
  let visitId="", secondId="", followupId="", dutyId="";
  const profile=async()=>{const r=await request(`/shops/${shop}`,manager);assert.equal(r.status,200);return r.data;};
  const count=async(table:string,where:string,args:unknown[]=[]) => (await db.query<{n:number}>(`SELECT count(*)::int n FROM ${table} WHERE ${where}`,args)).rows[0].n;
  try {
    await t.test("700 synthetic shops; authenticated server-side policies reject anonymous/CSRF/origin/spoofed performer",async()=>{
      assert.equal(await count("shops","synthetic"),700);
      assert.equal((await request("/shops")).status,401);
      assert.equal((await request("/checkin",exec,{shopId:shop,location},randomUUID(),{"X-CSRF-Token":"invalid"})).status,403);
      assert.equal((await request("/checkin",exec,{shopId:shop,location},randomUUID(),{Origin:"https://attacker.invalid"})).status,403);
      assert.equal((await request("/checkin",exec,{shopId:shop,location,visitorId:second.id})).status,422);
      assert.equal((await request("/checkin",manager,{shopId:shop,location})).status,403);
      assert.equal(await count("visits","lifecycle='open' AND visitor_id=$1",[exec.id]),0);
    });
    await t.test("same actor concurrent different-shop requests have one winner; same-shop second actor succeeds",async()=>{
      const replies=await Promise.all([shop,other].map(shopId=>request("/checkin",exec,{shopId,location})));
      assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
      visitId=replies.find(r=>r.status===200)!.data.visit.id;
      const actualShop=replies.find(r=>r.status===200)!.data.visit.shop_id;
      // Normalize the primary shop for later read assertions without relying on request arrival order.
      if(actualShop!==shop){assert.equal((await request(`/visits/${visitId}/checkout`,exec,body)).status,200);visitId=(await request("/checkin",exec,{shopId:shop,location})).data.visit.id;}
      const before=(await profile()).shop.assigned_executive_id;
      const r=await request("/checkin",second,{shopId:shop,location});assert.equal(r.status,200);secondId=r.data.visit.id;
      assert.notEqual(secondId,visitId);assert.equal(r.data.visit.visitor_id,second.id);
      assert.equal((await profile()).shop.assigned_executive_id,before);
      assert.equal((await request(`/visits/${visitId}/checkout`,second,body)).status,403);
      assert.equal((await request(`/visits/${visitId}/checkout`,manager,body)).status,403);
    });
    await t.test("unknown checkout acknowledgement is safely replayed; new key cannot overwrite completed history",async()=>{
      const before=await profile();const key=randomUUID();
      const r=await request(`/visits/${visitId}/checkout`,exec,{...body,followUpDate:"2099-06-15"},key);assert.equal(r.status,200);
      // Discarded acknowledgement from client perspective; replay exact key and payload.
      const retry=await request(`/visits/${visitId}/checkout`,exec,{...body,followUpDate:"2099-06-15"},key);assert.equal(retry.status,200);assert.deepEqual(retry.data,r.data);
      followupId=r.data.followup.id;
      assert.equal((await request(`/visits/${visitId}/checkout`,exec,{...body,notes:"Attempt to overwrite history"})).status,409);
      assert.equal(await count("followups","visit_id=$1",[visitId]),1);
      assert.equal(await count("audit_events","entity_id=$1 AND action='visit.checkout'",[visitId]),1);
      const after=await profile();for(const f of before.followups)assert.deepEqual(after.followups.find((row:any)=>row.id===f.id),f);
      assert.equal((await request(`/visits/${secondId}/checkout`,second,body)).status,200);
    });
    await t.test("follow-up independent lifecycle supports ownership, stale-write protection and explicit assignment",async()=>{
      assert.equal((await request(`/followups/${followupId}`,second,{action:"complete",version:1,reason:"Unauthorized attempt"})).status,403);
      const assigned=await request(`/followups/${followupId}/assign`,manager,{version:1,ownerId:second.id,reason:"Manager approved coverage"});assert.equal(assigned.status,200);
      assert.equal((await request(`/followups/${followupId}`,exec,{action:"complete",version:2,reason:"Former owner"})).status,403);
      const race=await Promise.all(["2099-07-01","2099-07-02"].map(dueDate=>request(`/followups/${followupId}`,second,{action:"reschedule",version:2,dueDate,reason:"Customer requested a later call"})));
      assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
      assert.equal((await request(`/followups/${followupId}`,second,{action:"complete",version:3,reason:"Customer contacted"})).status,200);
      assert.equal((await request(`/followups/${followupId}`,second,{action:"reschedule",version:4,dueDate:"2099-08-01",reason:"Completed item attempt"})).status,409);
    });
    await t.test("failed transaction rolls back visit, follow-up, audit and idempotency together then exact retry succeeds",async()=>{
      const v=await request("/checkin",exec,{shopId:shop,location});assert.equal(v.status,200);const id=v.data.visit.id,key=randomUUID();
      const audits=await count("audit_events","true"), followups=await count("followups","true");
      failCommit=true;assert.equal((await request(`/visits/${id}/checkout`,exec,{...body,followUpDate:"2099-09-01"},key)).status,500);
      assert.equal((await db.query<any>("SELECT lifecycle FROM visits WHERE id=$1",[id])).rows[0].lifecycle,"open");
      assert.equal(await count("audit_events","true"),audits);assert.equal(await count("followups","true"),followups);assert.equal(await count("idempotency","actor_id=$1 AND key=$2",[exec.id,key]),0);
      assert.equal((await request(`/visits/${id}/checkout`,exec,{...body,followUpDate:"2099-09-01"},key)).status,200);
    });
    await t.test("duty repeated break/return stays separate from visits and private to executive",async()=>{
      const start=await request("/duty/start",exec,{expectedSessionId:null});assert.equal(start.status,200);dutyId=start.data.sessionId;
      for(let i=0;i<2;i++){assert.equal((await request("/duty/rest",exec,{expectedSessionId:dutyId})).status,200);assert.equal((await request("/duty/return",exec,{expectedSessionId:dutyId})).status,200);}
      assert.equal((await request(`/duty?person=${exec.id}`,second)).status,403);
      assert.equal((await request("/duty/end",exec,{expectedSessionId:dutyId})).status,200);
      assert.equal(await count("rest_intervals","session_id=$1 AND ended_at IS NOT NULL",[dutyId]),2);
    });
    await t.test("manager reports and both native downloads enforce roles and filters",async()=>{
      const date=businessDay(new Date()), params=new URLSearchParams({from:date,to:date,person:exec.id});
      for(const kind of ["activity","duty","followups"]){
        assert.equal((await request(`/reports/${kind}?${params}`,exec)).status,403);
        assert.equal((await request(`/reports/${kind}/export?${params}&format=xlsx`,exec)).status,403);
        const r=await request(`/reports/${kind}?${params}`,manager);assert.equal(r.status,200);assert.equal(r.data.timeZone,"Asia/Dubai");assert.equal(r.data.person,exec.id);
        assert.ok(r.data.rows.every((row:any)=>(row.visitor_id??row.executive_id??row.owner_id)===exec.id));
        for(const format of ["xlsx","pdf"]){const r=await request(`/reports/${kind}/export?${params}&format=${format}`,manager);assert.equal(r.status,200);assert.match(r.headers.get("content-disposition")??"",/attachment/);assert.equal(r.bytes.subarray(0,format==="pdf"?5:2).toString(),format==="pdf"?"%PDF-":"PK");}
      }
      assert.equal((await request(`/reports/activity?from=2026-10-25&to=2026-10-20`,manager)).status,400);
      assert.equal((await request(`/reports/activity?person=${manager.id}`,manager)).status,404);
    });
    await t.test("disk restart preserves completed visit, reassigned follow-up and duty history",async()=>{
      await stop();await db.close();db=await openDatabase(dataPath);await migrate(db);server=application(wrapped,settings);await listen();
      const r=await profile();assert.equal(r.visits.find((v:any)=>v.id===visitId).lifecycle,"completed");assert.equal(r.followups.find((f:any)=>f.id===followupId).status,"completed");assert.equal(r.followups.find((f:any)=>f.id===followupId).owner_id,second.id);
      assert.equal(await count("duty_sessions","id=$1 AND ended_at IS NOT NULL",[dutyId]),1);
    });
    await t.test("logout revokes existing cookie, account disabling invalidates sessions immediately",async()=>{
      assert.equal((await request("/logout",exec,{})).status,200);assert.equal((await request("/me",exec)).status,401);
      await db.query("UPDATE users SET active=false WHERE id=$1",[second.id]);assert.equal((await request("/me",second)).status,401);
      assert.equal((await request(`/visits/${secondId}/checkout`,second,body)).status,401);
    });
  } finally {await stop();await db.close();await rm(directory,{recursive:true,force:true});}
});
