import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3100', out='evidence/phase4/usability';
const fixture=JSON.parse(await readFile('.local/phase3-demo-accounts.json','utf8'));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[],errors=[],blockedWrites=[],requests=[];
async function nav(page,view){await page.locator(`${await page.locator('#mobileNav').isVisible()?'#mobileNav':'#desktopNav'} [data-view="${view}"]`).click();await page.waitForFunction(()=>document.querySelector('#content')?.getAttribute('aria-busy')!=='true');}
async function shot(page,name,width){
 await page.evaluate(()=>document.fonts.ready); await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});
 if(name.includes('shop')||name.includes('dialog'))await page.screenshot({path:`${out}/${name}-viewport-${width}.png`});
 const layout=await page.evaluate(()=>({viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,nav:Array.from(document.querySelectorAll(getComputedStyle(document.querySelector('#mobileNav')).display!=='none'?'#mobileNav button':'#desktopNav button')).map(b=>({label:b.textContent.trim(),height:Math.round(b.getBoundingClientRect().height)})),brandVisible:Array.from(document.querySelectorAll('img[alt="Emerald Interlink"]')).some(n=>n.getBoundingClientRect().width>0),heading:document.querySelector('h1')?.textContent}));
 assert.ok(layout.pageWidth<=width,`${name} overflow at ${width}`);return layout;
}
try{
 for(const slug of ['ahmed','manager'])for(const width of [390,430,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:width<700?844:1000}});
  await context.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;requests.push({method:req.method(),path});if(!['GET','HEAD'].includes(req.method())&&!['/api/login','/api/logout'].includes(path)){blockedWrites.push({method:req.method(),path});await route.abort();return;}await route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);const account=fixture.accounts.find(a=>a.email===`${slug}@local.invalid`);
  if(slug==='ahmed'&&width===390)await page.screenshot({path:`${out}/login-390.png`,fullPage:true});
  await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('heading',{name:slug==='manager'?'Daily activity':'Your working day',exact:true}).waitFor();
  await page.getByText('Loading saved activity…',{exact:true}).waitFor({state:'hidden'});
  const home=await shot(page,`${slug}-home`,width);
  const dutyVisible=slug==='manager'?await page.getByText('Duty now',{exact:true}).count():await page.locator('.duty-card').count();
  if(slug==='manager'){
   await page.getByRole('link',{name:'Reports and downloads ↓',exact:true}).click();
   await page.locator('[data-manager-kind="followups"]').click();await page.getByText('Loading saved activity…',{exact:true}).waitFor({state:'hidden'});
   await page.locator('[data-manager-follow-scope]').waitFor();await shot(page,'manager-followups',width);
   await page.locator('[data-manager-kind="duty"]').click();await page.getByText('Loading saved activity…',{exact:true}).waitFor({state:'hidden'});await shot(page,'manager-duty',width);
  }
  await nav(page,'shops');await page.getByLabel('Search shops',{exact:true}).fill('Al Noor Building Materials');await page.locator('.results').filter({hasText:'1 shops'}).waitFor();
  await page.locator('[data-shop]').filter({hasText:'Al Noor Building Materials'}).first().click();await page.getByRole('heading',{name:'Shop profile',exact:true}).waitFor();
  await page.getByRole('link',{name:/^Follow-ups/}).click();const shop=await shot(page,`${slug}-shop`,width);
  const followupActions=await page.locator('[data-followup]').evaluateAll(nodes=>nodes.map(n=>n.textContent.trim()));
  if(slug==='ahmed'&&await page.getByRole('button',{name:'Complete',exact:true}).count()){
   await page.getByRole('button',{name:'Complete',exact:true}).first().click();await page.getByRole('heading',{name:'Complete follow-up',exact:true}).waitFor();await page.getByLabel('Completion note',{exact:false}).waitFor();await shot(page,'executive-complete-followup-dialog',width);await page.keyboard.press('Escape');
  }
  const destinations=[];for(const view of ['visits','leads','team','dashboard']){await nav(page,view);destinations.push({view,heading:await page.locator('h1').textContent()});}
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('heading',{name:'Sign in to your workspace',exact:true}).waitFor();await context.close();
  results.push({role:slug==='ahmed'?'executive':'manager',width,home,shop,dutyVisible,followupActions,destinations});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blockedWrites,[]);
 await writeFile(`${out}/inspection.json`,JSON.stringify({executedAt:new Date().toISOString(),origin,synthetic:true,mode:'Read-only role navigation; login/logout allowed. Follow-up completion dialog opened and dismissed without saving.',realPhone:false,humanAcceptance:false,results,errors,blockedWrites,requests},null,2));
 console.log('Read-only usability inspection passed: 10 fresh contexts, five widths, both roles, no operational writes or page errors.');
}finally{await browser.close();}
