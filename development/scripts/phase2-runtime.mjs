import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Read-only application smoke test, apart from session creation/revocation.
// Invoke only after the coordinator has approved the local synthetic runtime migration.
const origin='http://127.0.0.1:3100';
const fixture=JSON.parse(await readFile('.local/accounts.json','utf8'));
await mkdir('evidence/phase2',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const checks=[],tabletLayouts=[];
try {
  for(const slug of ['ahmed','manager']){
    const account=fixture.accounts.find(a=>a.email===`${slug}@local.invalid`);
    assert.ok(account,'Local synthetic review account must exist');
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await context.newPage();
    await page.goto(origin);
    await page.getByLabel('Email',{exact:true}).fill(account.email);
    await page.getByLabel('Password',{exact:true}).fill(account.password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
    const observed=await page.evaluate(async()=>{
      const me=await(await fetch('/api/me')).json();
      const shops=await(await fetch('/api/shops')).json();
      const dashboard=await(await fetch('/api/dashboard')).json();
      const r=await fetch('/api/reports/activity');
      return{role:me.actor.role,policies:me.policies,timezone:me.timezone,shops:shops.total,today:dashboard.metrics.today,reportStatus:r.status};
    });
    assert.equal(observed.policies.visit,'approved-v2');assert.equal(observed.policies.duty,'approved-v1');assert.equal(observed.timezone,'Asia/Dubai');assert.ok(observed.shops>=700);
    assert.equal(observed.reportStatus,slug==='manager'?200:403);
    if(slug==='manager')await page.getByRole('heading',{name:'Daily activity',exact:true}).waitFor();
    await page.screenshot({path:`evidence/phase2/runtime-${slug}-1440.png`,fullPage:true});
    if(slug==='ahmed'){
      await page.locator('#desktopNav [data-view="visits"]').click();
      await page.getByRole('heading',{name:'Visit history',exact:true}).waitFor();
    }else await page.getByText('Loading saved activity…',{exact:true}).waitFor({state:'hidden'});
    for(const width of [768,1024]){
      await page.setViewportSize({width,height:1000});
      const tables=await page.locator('.mobile-cards').evaluateAll(elements=>elements.map(element=>{
        const rect=element.getBoundingClientRect();
        const cells=Array.from(element.querySelectorAll('tbody tr:first-child td')).map(cell=>{const b=cell.getBoundingClientRect();return{label:cell.getAttribute('data-label'),left:b.left,right:b.right,inside:b.left>=rect.left-1&&b.right<=rect.right+1,display:getComputedStyle(cell).display};});
        return{clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,cells};
      }));
      assert.ok(tables.length>0,'A populated visit/staff table must be present');
      for(const table of tables){assert.equal(table.scrollWidth,table.clientWidth,`${slug} tablet ${width} internal table overflow`);assert.ok(table.cells.every(cell=>cell.inside&&cell.display!=='none'),`${slug} tablet ${width} hides important cells`);}
      tabletLayouts.push({role:observed.role,width,tables});
      await page.screenshot({path:`evidence/phase2/runtime-${slug}-tablet-${width}.png`,fullPage:true});
    }
    await page.getByRole('button',{name:'Sign out',exact:true}).click();
    assert.equal(await page.evaluate(async()=>(await fetch('/api/me')).status),401);
    checks.push({slug,...observed,logoutRevoked:true});await context.close();
  }
  await writeFile('evidence/phase2/runtime.json',JSON.stringify({executedAt:new Date().toISOString(),origin,checks,tabletLayouts},null,2));
  console.log('Local synthetic runtime: executive and manager session, policies, data, role protection and logout verified.');
}finally{await browser.close();}
