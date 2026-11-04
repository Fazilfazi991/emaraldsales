import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {openDatabase,migrate} from '../src/database.js';
import {seedSynthetic} from '../src/fixtures.js';
import {application} from '../src/server.js';
import type {Config} from '../src/config.js';

// A delayed anonymous metadata response must not replace a sign-in form that
// is already accepting input. Real session loss must still require sign-in.
const db=await openDatabase();await migrate(db);const fixture=await seedSynthetic(db,36),account=fixture.accounts.find(a=>a.role==='executive')!;
const settings:Config={host:'127.0.0.1',port:0,origin:'http://127.0.0.1',dataDir:'',secure:false,visitPolicy:'approved-v2',dutyPolicy:'approved-v1'};
const server=application(db,settings);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));settings.origin=`http://127.0.0.1:${(server.address() as any).port}`;
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage();let first=true,release!:()=>void;
 const delayed=new Promise<void>(resolve=>release=resolve),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/metadata',async route=>{if(!first){await route.continue();return;}first=false;const response=await route.fetch();assert.equal(response.status(),401);await delayed;await route.fulfill({response});});
 await page.goto(settings.origin);await page.locator('#email').waitFor();assert.equal(await page.locator('#loginError').innerText(),'');
 await page.locator('#email').fill(account.email);await page.locator('#password').fill(account.password);
 const metadata=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/metadata');release();await metadata;
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.locator('#loginError').innerText(),'');assert.ok(await page.locator('#email').inputValue()===account.email,'Email input survives late anonymous response');assert.ok(await page.locator('#password').inputValue()===account.password,'Password input survives late anonymous response');
 await page.locator('#password').fill('incorrect-synthetic-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('#loginError')?.textContent);assert.doesNotMatch(await page.locator('#loginError').innerText(),/session expired/i);
 await page.locator('#password').fill(account.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#desktopNav').waitFor();
 await context.clearCookies();await page.locator('#desktopNav [data-view="shops"]').click();await page.locator('#email').waitFor();assert.match(await page.locator('#loginError').innerText(),/session expired/i);
 assert.equal((await context.request.get(settings.origin+'/api/shops')).status(),401);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({anonymousStartup:true,lateResponsePreservesInput:true,invalidLoginFeedback:true,validLogin:true,expiredSessionRequiresLogin:true,anonymousDataDenied:true,javascriptErrors:0}));
 await context.close();
}finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
