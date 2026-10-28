import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {openDatabase,migrate} from '../src/database.js';
import {seedSynthetic} from '../src/fixtures.js';
import {application} from '../src/server.js';
import type {Config} from '../src/config.js';
await mkdir('.local/navigation-review',{recursive:true});
const db=await openDatabase();await migrate(db);const fixture=await seedSynthetic(db,36);
const settings:Config={host:'127.0.0.1',port:0,origin:'http://127.0.0.1',secure:false,dataDir:'',visitPolicy:'approved-v2',dutyPolicy:'approved-v1'};
const server=application(db,settings);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));settings.origin='http://127.0.0.1:'+(server.address() as any).port;
const browser=await chromium.launch({channel:process.env.CRM_BROWSER_CHANNEL??(process.platform==='win32'?'msedge':undefined),headless:true});let checks=0;
try{
 for(const role of ['executive','manager']){
 const context=await browser.newContext({viewport:{width:1440,height:950}}),page=await context.newPage();let errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const account=fixture.accounts.find(a=>a.role===role)!;
 await page.goto(settings.origin);await page.locator('#email').fill(account.email);await page.locator('#password').fill(account.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#desktopNav [data-view="shops"]').waitFor();
 await page.waitForFunction(()=>!document.querySelector('#content')?.hasAttribute('aria-busy'));
 const nav=async(view:string)=>{await page.locator('#desktopNav [data-view="'+view+'"]').click();await page.waitForFunction(()=>!document.querySelector('#content')?.hasAttribute('aria-busy'));};
 await nav('shops');await page.locator('#search').fill('Synthetic');await page.waitForTimeout(400);await page.waitForFunction(()=>!document.querySelector('#content')?.hasAttribute('aria-busy'));
 await nav('leads');await nav('shops');assert.equal(await page.locator('#search').inputValue(),'Synthetic');checks++;
 await page.locator('#search').fill('');await page.waitForTimeout(350);await page.waitForFunction(()=>!document.querySelector('#content')?.hasAttribute('aria-busy'));
 const seen:string[]=[];page.on('request',r=>{if(r.url().includes('/api/'))seen.push(new URL(r.url()).pathname);});
 await page.locator('#content [data-shop]').first().click();await page.locator('.hero-shop').waitFor();assert.ok(!seen.includes('/api/dashboard'));checks++;
 for(const width of [390,430,768,1024,1440]){
  await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);checks++;
  await page.screenshot({path:'.local/navigation-review/local-profile-'+role+'-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1440,height:950});await nav('dashboard');
 if(role==='manager'){
 await page.locator('.manager-reports .kpis').waitFor();
 await page.locator('[data-manager-kind="duty"]').click();await page.waitForFunction(()=>!document.querySelector('.manager-reports [role="status"]')?.textContent?.includes('Loading'));
 await nav('shops');await nav('dashboard');await page.locator('[data-manager-kind="duty"][aria-pressed="true"]').waitFor();checks++;
 }
 for(const width of [390,430,768,1024,1440]){
  await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);checks++;
  await page.screenshot({path:'.local/navigation-review/local-dashboard-'+role+'-'+width+'.png',fullPage:true});
 }
 for(const section of ['shops','leads','visits','team',...(role==='manager'?['accounts']:[])]){
  await page.setViewportSize({width:1440,height:950});await nav(section);
  for(const width of [390,430,768,1024,1440]){
   await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,role+' '+section+' '+width);checks++;
  }
 }
 await page.setViewportSize({width:1440,height:950});
 // A slow obsolete GET must not hold up the next navigation or overwrite it.
 await page.route('**/api/shops?**',async route=>{await new Promise(r=>setTimeout(r,1200));await route.continue().catch(()=>{});});
 await page.locator('#desktopNav [data-view="shops"]').click();
 assert.equal(await page.locator('#desktopNav [data-view="shops"]').getAttribute('aria-current'),'page');
 await nav('visits');await page.waitForTimeout(1300);assert.match(await page.locator('#content h1').innerText(),/Visit history/);checks+=2;
 assert.deepEqual(errors,[]);await context.close();
 }
 console.log(JSON.stringify({browserChecks:checks,roles:2,widths:[390,430,768,1024,1440],scriptErrors:0,filterRetention:true,staleRequestsCancelled:true,profileDashboardRequestRemoved:true}));
}finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));await db.close();}
