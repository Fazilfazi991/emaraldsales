import {chromium,type BrowserContext,type Page} from "playwright";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {syntheticId} from "../src/fixtures.js";
const origin="http://127.0.0.1:3100",out="evidence/phase3/demo";
const fixture=JSON.parse(await readFile(".local/phase3-demo-accounts.json","utf8"));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:"msedge",headless:true});
const checks:string[]=[],downloads:unknown[]=[],errors:string[]=[];
async function login(context:BrowserContext,slug:string){const account=fixture.accounts.find((a:any)=>a.email===`${slug}@local.invalid`);const page=await context.newPage();page.setDefaultTimeout(30000);page.on("pageerror",e=>errors.push(e.message));await page.goto(origin);await page.getByLabel("Email",{exact:true}).fill(account.email);await page.getByLabel("Password",{exact:true}).fill(account.password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await page.getByRole("heading",{name:slug==="manager"?"Daily activity":"Your working day",exact:true}).waitFor();return page;}
async function navigate(page:Page,view:string){await page.locator(`${await page.locator("#mobileNav").isVisible()?"#mobileNav":"#desktopNav"} [data-view="${view}"]`).click();}
async function shop(page:Page){await navigate(page,"shops");await page.getByLabel("Search shops",{exact:true}).fill("Al Noor Building Materials");await page.locator(".results").filter({hasText:"1 shops"}).waitFor();await page.locator("[data-shop]").filter({hasText:"Al Noor Building Materials"}).first().click();await page.getByRole("heading",{name:"Shop profile",exact:true}).waitFor();}
async function shot(page:Page,name:string,width:number){await page.setViewportSize({width,height:width<700?844:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});}
async function persisted(page:Page,visitId:string){
  const data=await page.evaluate(async({shopId,visitId})=>{const data=await(await fetch(`/api/shops/${shopId}`)).json();return{visit:data.visits.find((v:any)=>v.id===visitId),followups:data.followups.filter((f:any)=>f.visit_id===visitId)};},{shopId:syntheticId("shop-1"),visitId});
  assert.equal(data.visit.lifecycle,"completed");assert.equal(data.followups.length,1);assert.equal(data.followups[0].status,"pending");
}
try{
  let ctx=await browser.newContext({viewport:{width:390,height:844}}),exec=await login(ctx,"ahmed");
  await exec.getByRole("button",{name:"Start duty",exact:true}).click();await exec.getByRole("button",{name:"End duty",exact:true}).waitFor();await shot(exec,"executive-day",390);
  await shop(exec);await exec.getByRole("button",{name:"Check in to this shop",exact:false}).click();await exec.locator("[data-checkout]").waitFor();const visitId=(await exec.locator("[data-checkout]").getAttribute("data-checkout"))!;await exec.locator("[data-checkout]").click();
  const note="Demonstration: customer requested cement prices and delivery availability. اتصل غداً";
  await exec.getByLabel("What did you discuss?",{exact:false}).fill(note);await shot(exec,"executive-checkout",390);
  await exec.getByRole("button",{name:"Check Out · Save Visit",exact:true}).click();await exec.locator("#dialog").waitFor({state:"hidden"});await exec.getByText("Visit completed and saved.",{exact:true}).waitFor();
  await exec.getByRole("button",{name:"Add follow-up",exact:true}).click();const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dubai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());await exec.getByLabel("Follow-up date",{exact:false}).fill(day);await exec.getByRole("button",{name:"Save follow-up",exact:true}).click();await exec.locator("#dialog").waitFor({state:"hidden"});
  for(const width of [390,430,768,1024,1440])await shot(exec,"executive-history",width);
  await exec.reload();await shop(exec);await exec.getByText(note,{exact:true}).first().waitFor();await persisted(exec,visitId);await exec.getByRole("button",{name:"Sign out",exact:true}).click();await ctx.close();
  ctx=await browser.newContext({viewport:{width:390,height:844}});exec=await login(ctx,"ahmed");await shop(exec);await exec.getByText(note,{exact:true}).first().waitFor();await persisted(exec,visitId);
  await navigate(exec,"dashboard");await exec.getByRole("button",{name:"Start break",exact:true}).click();await exec.getByRole("button",{name:"Return to duty",exact:true}).click();await exec.getByRole("button",{name:"End duty",exact:true}).click();await exec.getByRole("button",{name:"Start duty",exact:true}).waitFor();
  await exec.getByRole("button",{name:"Sign out",exact:true}).click();await ctx.close();checks.push("Executive complete daily journey, refresh and fresh login persisted visit/follow-up and ended duty");
  let mgrCtx=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),manager=await login(mgrCtx,"manager");
  await manager.getByText("Loading saved activity…",{exact:true}).waitFor({state:"hidden"});
  for(const width of [390,430,768,1024,1440])await shot(manager,"manager-overview",width);
  const own=fixture.accounts.find((a:any)=>a.email==="ahmed@local.invalid");await manager.getByLabel("Sales executive",{exact:true}).selectOption(own.id);await manager.getByRole("button",{name:"Show activity",exact:true}).click();await manager.getByText("Loading saved activity…",{exact:true}).waitFor({state:"hidden"});
  for(const kind of ["activity","duty","followups"]){
    await manager.locator(`[data-manager-kind=${kind}]`).click();await manager.getByText("Loading saved activity…",{exact:true}).waitFor({state:"hidden"});
    for(const format of ["xlsx","pdf"]){const event=manager.waitForEvent("download");await manager.locator(`[data-manager-export=${format}]`).click();const file=await event;assert.equal(await file.failure(),null);const path=`${out}/selected-${kind}.${format}`;await file.saveAs(path);const bytes=await readFile(path);assert.equal(bytes.subarray(0,format==="pdf"?5:2).toString(),format==="pdf"?"%PDF-":"PK");if(format==="xlsx"){const book=new ExcelJS.Workbook();await book.xlsx.readFile(path);const sheet=book.getWorksheet("Report")!;assert.ok(sheet.getCell("A3").text.includes(own.name));assert.ok(sheet.rowCount>5);assert.ok(sheet.getCell("A4").text.length>0);if(kind==="duty")assert.ok(book.getWorksheet("Break history")!.rowCount>=2);}downloads.push({kind,format,bytes:bytes.length,selectedStaff:own.name,dates:day,populated:true});}
    await shot(manager,`manager-${kind}`,1440);
  }
  await shop(manager);await manager.getByText(note,{exact:true}).first().waitFor();await persisted(manager,visitId);await shot(manager,"manager-customer-history",1440);await manager.reload();await shop(manager);await manager.getByText(note,{exact:true}).first().waitFor();await persisted(manager,visitId);await manager.getByRole("button",{name:"Sign out",exact:true}).click();await mgrCtx.close();
  mgrCtx=await browser.newContext({viewport:{width:1440,height:1000}});manager=await login(mgrCtx,"manager");await shop(manager);await manager.getByText(note,{exact:true}).first().waitFor();await persisted(manager,visitId);await manager.getByRole("button",{name:"Sign out",exact:true}).click();await mgrCtx.close();checks.push("Separate manager attendance, visits by executive, pending follow-ups, customer history, Excel/PDF and fresh login persistence");
  assert.deepEqual(errors,[]);await writeFile(`${out}/runtime.json`,JSON.stringify({executedAt:new Date().toISOString(),origin,synthetic:true,checks,downloads,widths:[390,430,768,1024,1440],errors},null,2));console.log("Actual port 3100 synthetic demo: complete executive/manager journeys, persistence, five widths and six populated downloads passed.");
}finally{await browser.close();}
