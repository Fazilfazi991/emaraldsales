import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
// Read credentials locally without logging them or returning them to the model.
const fixture=JSON.parse(await readFile('.local/accounts.json','utf8'));
const account=fixture.accounts.find(a=>a.email==='ahmed@local.invalid');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto('http://127.0.0.1:3100/');await page.screenshot({path:'evidence/development-login-1440.png',fullPage:true});
  await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('heading',{name:'Today’s field activity',exact:true}).waitFor();
  await page.screenshot({path:'evidence/development-current-policy-pending-1440.png',fullPage:true});
  const result=await page.evaluate(async()=>{
    const me=await(await fetch('/api/me')).json();const shops=await(await fetch('/api/shops?q=Al%20Noor')).json();
    const r=await fetch('/api/checkin',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({shopId:shops.rows[0].id,location:{availability:'not_requested'}})});
    return {policies:me.policies,timezone:me.timezone,writeStatus:r.status,writeResult:(await r.json()).error.code};
  });assert.equal(result.policies.visit,'pending');assert.equal(result.policies.duty,'approved-v1');assert.equal(result.writeStatus,409);assert.equal(result.writeResult,'POLICY_PENDING');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await writeFile('evidence/local-runtime.json',JSON.stringify({executedAt:new Date().toISOString(),origin:'http://127.0.0.1:3100',...result},null,2));
  console.log('Prepared local runtime sign-in, policy gate and sign-out verified.');
}finally{await browser.close();}
