import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,migrate} from '../src/database.js';
import {seedSynthetic} from '../src/fixtures.js';
import {CRM} from '../src/service.js';
import {Administration} from '../src/admin.js';
import {createAccount} from '../src/auth.js';
import {Fault,type Actor} from '../src/domain.js';

test('Admin workspace: separation, bounded saved overview, employee lifecycle and immutable history',async t=>{
 const db=await openDatabase();try{
  await migrate(db);const f=await seedSynthetic(db,36),crm=new CRM(db,{visitPolicy:'approved-v2',dutyPolicy:'approved-v1'}),admin=new Administration(db);
  const actor=(role:Actor['role']):Actor=>{const a=f.accounts.find(a=>a.role===role)!;return {id:a.id,role,name:a.name,organizationId:f.organizationId};};
  const owner=actor('admin'),manager=actor('manager'),executive=actor('executive');
  const forbidden=(e:unknown)=>e instanceof Fault&&e.status===403;
  await t.test('all other roles rejected by every administrative operation',async()=>{
   const id=await createAccount(db,f.organizationId,'delivery-admin-test@synthetic.invalid','Fictional Delivery','delivery','fictional-only-password-123');
   for(const a of [manager,executive,{...executive,id,role:'delivery' as const}]){
    await assert.rejects(()=>admin.overview(a,new URLSearchParams()),forbidden);
    await assert.rejects(()=>admin.employees(a,new URLSearchParams()),forbidden);
    await assert.rejects(()=>admin.history(a,new URLSearchParams()),forbidden);
    await assert.rejects(()=>crm.accounts(a),forbidden);
    await assert.rejects(()=>crm.addAccount(a,randomUUID(),{}),forbidden);
    assert.throws(()=>crm.setAccountActive(a,randomUUID(),executive.id,{active:false}),forbidden);
    assert.throws(()=>crm.setAccountRole(a,randomUUID(),executive.id,{role:'admin'}),forbidden);
    await assert.rejects(()=>crm.resetAccountPassword(a,randomUUID(),executive.id,{}),forbidden);
   }
  });
  await t.test('one snapshot has recorded totals, correct duty clipping and no row multiplication',async()=>{
   const sid=randomUUID(),rid=randomUUID();
   await db.query(`INSERT INTO duty_sessions(id,organization_id,executive_id,started_at,ended_at) VALUES($1,$2,$3,date_trunc('day',now() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai'-interval '1 hour',date_trunc('day',now() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai'+interval '2 hour')`,[sid,f.organizationId,executive.id]);
   await db.query(`INSERT INTO rest_intervals(id,organization_id,session_id,started_at,ended_at) SELECT $1,organization_id,id,ended_at-interval '30 min',ended_at FROM duty_sessions WHERE id=$2`,[rid,sid]);
   // Clock may be before fixture end; all durations are capped at the read time.
   const before=(await db.query<any>('SELECT count(*)::int n FROM shops')).rows[0].n;
   const result=await admin.overview(owner,new URLSearchParams());
   assert.equal(result.totals.employees,6);assert.equal(result.customers+result.enquiries,before);
   assert.equal(result.rows.length,6);const e=result.rows.find((r:any)=>r.id===executive.id);assert.ok(e.working_minutes>=0&&e.working_minutes<=120);
   assert.ok(result.rows.every((r:any)=>!('password_hash' in r)&&!('email' in r)));
   const expected=(await db.query<any>("SELECT count(*)::int n FROM followups WHERE status='pending'")).rows[0].n;assert.equal(Number(result.totals.pending),expected);
  });
  await t.test('Admin creates all existing roles with safe retries; mutations revoke only target sessions',async()=>{
   for(const role of ['executive','manager','admin','delivery'] as const){
    const key=randomUUID(),body={name:'Fictional '+role,email:role+'-new@synthetic.invalid',role,password:'fictional-test-password-1234'};
    const a=await crm.addAccount(owner,key,body);assert.deepEqual(a,await crm.addAccount(owner,key,body));
   }
   const id=(await crm.addAccount(owner,randomUUID(),{name:'Fictional change target',email:'change-target@synthetic.invalid',role:'delivery',password:'fictional-test-password-1234'})).id;
   for(const user of [id,manager.id])await db.query("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,'test',now()+interval '1 hour')",[randomUUID(),user]);
   await crm.setAccountRole(owner,randomUUID(),id,{role:'executive'});
   assert.equal((await db.query('SELECT 1 FROM sessions WHERE user_id=$1',[id])).rows.length,0);
   assert.equal((await db.query('SELECT 1 FROM sessions WHERE user_id=$1',[manager.id])).rows.length,1);
   await crm.setAccountActive(owner,randomUUID(),id,{active:false});
   await crm.setAccountActive(owner,randomUUID(),id,{active:true});
   await crm.resetAccountPassword(owner,randomUUID(),id,{password:'new-fictional-test-password-1234'});
   const history=await admin.history(owner,new URLSearchParams());assert.ok(history.total>=8);assert.ok(!JSON.stringify(history).includes('password-1234'));
   await assert.rejects(()=>db.query('DELETE FROM audit_events WHERE entity_id=$1',[id]));
  });
  await t.test('self protection, inactive targets, cross-company and bounded pagination',async()=>{
   assert.throws(()=>crm.setAccountActive(owner,randomUUID(),owner.id,{active:false}),(e:any)=>e.code==='INVALID_ACCOUNT');
   assert.throws(()=>crm.setAccountRole(owner,randomUUID(),owner.id,{role:'manager'}),(e:any)=>e.code==='INVALID_ACCOUNT');
   await assert.rejects(()=>crm.setAccountActive(owner,randomUUID(),randomUUID(),{active:false}),(e:any)=>e.status===404);
   const onlyManagers=await admin.employees(owner,new URLSearchParams('q=Fictional%20manager'));assert.equal(onlyManagers.total,1);
   const empty=await admin.employees(owner,new URLSearchParams('page=999'));assert.equal(empty.rows.length,0);assert.ok(empty.total>0);
   for(let i=0;i<18;i++)await createAccount(db,f.organizationId,`page-${i}@synthetic.invalid`,'Pagination '+i,'delivery','fictional-test-password-1234');
   const first=await admin.employees(owner,new URLSearchParams()),second=await admin.employees(owner,new URLSearchParams('page=1'));
   assert.equal(first.rows.length,25);assert.equal(new Set([...first.rows,...second.rows].map((r:any)=>r.id)).size,first.total);
   assert.ok(first.rows.every((r:any)=>!('password_hash' in r)));
  });
 }finally{await db.close();}
});
