import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {openDatabase,migrate} from "../src/database.js";
import {seedSynthetic} from "../src/fixtures.js";
import {createAccount} from "../src/auth.js";
import {application} from "../src/server.js";
import type {Config} from "../src/config.js";

test("delivery staff can record their own duty but cannot access CRM records or collection writes",async()=>{
  const db=await openDatabase(); await migrate(db); const fixture=await seedSynthetic(db,36);
  const id=await createAccount(db,fixture.organizationId,"delivery@synthetic.invalid","Delivery Staff","delivery","fictional-password-123456");
  const cfg:Config={host:"127.0.0.1",port:0,origin:"http://127.0.0.1",dataDir:"",secure:false,visitPolicy:"approved-v2",dutyPolicy:"approved-v1"};
  const server=application(db,cfg); await new Promise<void>(r=>server.listen(0,"127.0.0.1",r)); cfg.origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  try {
    const login=await fetch(`${cfg.origin}/api/login`,{method:"POST",headers:{Origin:cfg.origin,"Content-Type":"application/json"},body:JSON.stringify({email:"delivery@synthetic.invalid",password:"fictional-password-123456"})});
    assert.equal(login.status,200); const csrf=(await login.json()).csrf, cookie=login.headers.get("set-cookie")!.split(";")[0];
    const req=async(path:string,body?:unknown)=>fetch(`${cfg.origin}/api${path}`,{method:body===undefined?"GET":"POST",headers:{Origin:cfg.origin,Cookie:cookie,"X-CSRF-Token":csrf,...(body===undefined?{}:{"Content-Type":"application/json","Idempotency-Key":randomUUID()})},body:body===undefined?undefined:JSON.stringify(body)});
    for(const path of ["/shops","/dashboard","/reports/activity","/collections"]) assert.equal((await req(path)).status,403);
    assert.equal((await req("/metadata")).status,200);
    const m=await (await req("/metadata")).json(); assert.equal(m.team.length,1); assert.equal(m.team[0].id,id); assert.deepEqual(m.areas,[]);
    const start=await (await req("/duty/start",{expectedSessionId:null})).json(); assert.equal(start.state,"on");
    for(const [action,state] of [["rest","rest"],["return","on"],["end","off"]]) assert.equal((await (await req(`/duty/${action}`,{expectedSessionId:start.sessionId})).json()).state,state);
    assert.equal((await req(`/duty?person=${fixture.accounts.find(a=>a.role==="executive")!.id}`)).status,403);
  } finally {await new Promise<void>(r=>server.close(()=>r()));await db.close();}
});
