import { test } from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {openDatabase,migrate} from "../src/database.js";
import {seedSynthetic} from "../src/fixtures.js";
import {passwordMatches} from "../src/auth.js";
import {CRM} from "../src/service.js";
import {Fault,type Actor} from "../src/domain.js";

test("admin can disable and recover an account without leaking credentials or retaining sessions",async()=>{
  const db=await openDatabase(); try {
    await migrate(db);const f=await seedSynthetic(db,36);
    const actor=(role:Actor["role"]):Actor=>{const a=f.accounts.find(x=>x.role===role)!;return {id:a.id,name:a.name,role,organizationId:f.organizationId};};
    const admin=actor("admin"),manager=actor("manager"),executive=actor("executive"),crm=new CRM(db,{visitPolicy:"approved-v2",dutyPolicy:"approved-v1"});
    assert.throws(()=>crm.setAccountActive(manager,randomUUID(),executive.id,{active:false}),(e:unknown)=>e instanceof Fault&&e.status===403);
    assert.throws(()=>crm.setAccountActive(admin,randomUUID(),admin.id,{active:false}),(e:unknown)=>e instanceof Fault&&e.code==="INVALID_ACCOUNT");
    await db.query("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,'synthetic',now()+interval '1 hour')",[randomUUID(),executive.id]);
    await crm.setAccountActive(admin,randomUUID(),executive.id,{active:false});
    assert.equal((await db.query<{n:number}>("SELECT count(*)::int n FROM sessions WHERE user_id=$1",[executive.id])).rows[0].n,0);
    await crm.setAccountActive(admin,randomUUID(),executive.id,{active:true});
    await db.query("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,'synthetic',now()+interval '1 hour')",[randomUUID(),executive.id]);
    const password="fictional-new-password-12345",key=randomUUID();
    const first=await crm.resetAccountPassword(admin,key,executive.id,{password}), again=await crm.resetAccountPassword(admin,key,executive.id,{password}); assert.deepEqual(first,again);
    assert.equal((await db.query<{n:number}>("SELECT count(*)::int n FROM sessions WHERE user_id=$1",[executive.id])).rows[0].n,0);
    const hash=(await db.query<{password_hash:string}>("SELECT password_hash FROM users WHERE id=$1",[executive.id])).rows[0].password_hash;
    assert.ok(await passwordMatches(password,hash));
    const audit=(await db.query<{details:unknown}>("SELECT details FROM audit_events WHERE entity_id=$1 AND action='account.password_reset'",[executive.id])).rows;
    assert.equal(audit.length,1);assert.ok(!JSON.stringify(audit).includes(password));
    const keys=(await db.query<{response:unknown;request_hash:string}>("SELECT response,request_hash FROM idempotency WHERE actor_id=$1 AND key=$2",[admin.id,key])).rows;
    assert.ok(!JSON.stringify(keys).includes(password));
  } finally {await db.close();}
});
