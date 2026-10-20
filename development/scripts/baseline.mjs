import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('evidence',{recursive:true});await mkdir('fixtures',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8080/demo/emerald-interlink/');
const seed=await page.evaluate(()=>JSON.parse(localStorage.getItem('fusion-emerald-interlink-field-crm-v1')));
// Export only the untouched fictional fixtures, never operational storage.
await writeFile('fixtures/reference-synthetic.json',JSON.stringify({shops:seed.shops,visits:seed.visits},null,2));
for(const [id,label] of [['dashboard','Dashboard'],['shops','Shops'],['visits','Visits'],['leads','Leads'],['team','Sales Team']]){
  await page.locator(`#desktopNav [data-view="${id}"]`).click();await page.screenshot({path:`evidence/reference-${id}-1440.png`,fullPage:true});
}
await page.locator('#desktopNav [data-view="shops"]').click();await page.getByLabel('Search shops').fill('Al Noor');
await page.locator('[data-open-shop="shop-1"]').first().click();
const historyBefore=await page.locator('.visit-record').count();
await page.locator('[data-checkin="shop-1"]').click();await page.locator('[data-checkout]').first().click();
await page.locator('[name="notes"]').fill('Baseline synthetic journey: discussed board requirements.');
await page.getByRole('button',{name:'Check Out · Save Visit',exact:true}).click();
const historyAfter=await page.locator('.visit-record').count();
await page.screenshot({path:'evidence/reference-shop-history-1440.png',fullPage:true});
await page.locator('#salesperson').selectOption('naseer');
const identityAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('fusion-emerald-interlink-field-crm-v1')).salesperson);
await page.reload();const persisted=await page.locator('.kpi').count()===5;
await page.setViewportSize({width:390,height:844});await page.locator('#mobileNav [data-view="shops"]').click();
await page.screenshot({path:'evidence/reference-shops-390.png',fullPage:true});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
const html=await readFile('../reference/emerald-field-sales-crm-source/public/demo/emerald-interlink/index.html');
await writeFile('evidence/baseline.json',JSON.stringify({sha256:createHash('sha256').update(html).digest('hex'),shops:seed.shops.length,team:3,historyBefore,historyAfter,identityAfter,identityDefectConfirmed:identityAfter==='ahmed',reloadDashboard:persisted,mobileOverflow:overflow,errors,executedAt:new Date().toISOString()},null,2));
await browser.close();console.log('Baseline captured; see evidence/baseline.json.');
