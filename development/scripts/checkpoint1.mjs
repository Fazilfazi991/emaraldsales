import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3100';
const fixture=JSON.parse(await readFile('.local/accounts.json','utf8'));
const account=fixture.accounts.find(a=>a.role==='manager');
const response=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});
assert.equal(response.status,200);const session=await response.json(),cookie=response.headers.get('set-cookie').split(';')[0];
const get=async route=>{const r=await fetch(origin+route,{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json();};
try{
  const [me,shops,metadata,dashboard]=await Promise.all(['/api/me','/api/shops','/api/metadata','/api/dashboard'].map(get));
  assert.equal(shops.total,700);assert.equal(shops.rows.length,40);assert.equal(metadata.team.filter(p=>p.role==='executive').length,3);
  assert.equal(me.policies.visit,'pending');assert.equal(me.actor.role,'manager');
  const unauth=await fetch(origin+'/api/shops');assert.equal(unauth.status,401);
  await writeFile('evidence/phase2/checkpoint1-runtime.json',JSON.stringify({executedAt:new Date().toISOString(),origin,authenticatedRole:me.actor.role,totalShops:shops.total,pageRows:shops.rows.length,executives:3,policies:me.policies,unauthenticatedStatus:unauth.status,dashboardCounterConsistency:dashboard.metrics.today===dashboard.today.total},null,2));
  console.log('Checkpoint 1 actual runtime: real manager session, 700 shops, 3 executives, visit policy pending, unauthenticated access denied.');
}finally{await fetch(origin+'/api/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'},body:'{}'});}
