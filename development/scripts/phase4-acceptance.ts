import {chromium,type BrowserContext,type Page} from "playwright";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {syntheticId} from "../src/fixtures.js";
import {businessDay,addDays} from "../src/domain.js";

// Mutates only the prepared synthetic local demo through its authenticated UI.
// It refuses an existing open visit/duty instead of closing someone else's work.
const origin="http://127.0.0.1:3100",out="evidence/phase4/runtime",widths=[390,430,768,1024,1440];
const fixture=JSON.parse(await readFile(".local/phase3-demo-accounts.json","utf8"));
assert.match(fixture.purpose,/Synthetic local demonstration/);
const own=fixture.accounts.find((a:any)=>a.email==="ahmed@local.invalid"),shopId=syntheticId("shop-1");
const today=businessDay(new Date()),note="Phase 4 acceptance: customer requested a quotation. اتصل غداً";
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:"msedge",headless:true});
const checks:string[]=[],downloads:Record<string,unknown>[]=[],layouts:Record<string,unknown>[]=[],errors:string[]=[];
let exec:Page|undefined,manager:Page|undefined,visitId="",followupId="",dutyId="";
async function login(context:BrowserContext,slug:string){
  const account=fixture.accounts.find((a:any)=>a.email===`${slug}@local.invalid`);
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on("pageerror",e=>errors.push(e.message));
  await page.goto(origin);await page.getByLabel("Email",{exact:true}).fill(account.email);await page.getByLabel("Password",{exact:true}).fill(account.password);await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await page.getByRole("heading",{name:slug==="manager"?"Daily activity":"Your working day",exact:true}).waitFor();return page;
}
async function read(page:Page,path:string){return page.evaluate(async path=>{const response=await fetch(`/api${path}`);if(!response.ok)throw Error(`Read failed: ${response.status}`);return response.json();},path);}
async function navigate(page:Page,view:string){await page.locator(`${await page.locator("#mobileNav").isVisible()?"#mobileNav":"#desktopNav"} [data-view="${view}"]`).click();}
async function shop(page:Page){await navigate(page,"shops");await page.getByLabel("Search shops",{exact:true}).fill("Al Noor Building Materials");await page.locator(".results").filter({hasText:"1 shops"}).waitFor();await page.locator("[data-shop]").filter({hasText:"Al Noor Building Materials"}).first().click();await page.getByRole("heading",{name:"Shop profile",exact:true}).waitFor();}
async function loaded(page:Page){await page.getByText("Loading saved activity…",{exact:true}).waitFor({state:"hidden"});}
async function shot(page:Page,role:string,state:string,width:number){
  await page.setViewportSize({width,height:width<700?844:1000});
  const observed=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(observed.document<=width);
  layouts.push({role,state,width,...observed});await page.screenshot({path:`${out}/${role}-${state}-${width}.png`,fullPage:true});
}
async function staffState(state:string){
  await manager!.getByRole("button",{name:"Show activity",exact:true}).click();await loaded(manager!);
  const row=manager!.locator(".panel").filter({has:manager!.getByRole("heading",{name:"Staff activity",exact:true})}).locator("tbody tr").filter({has:manager!.getByRole("button",{name:own.name,exact:true})});
  await row.getByText(state,{exact:true}).waitFor();
  const data=await read(manager!,`/reports/activity?from=${today}&to=${today}&person=${own.id}`);assert.equal(data.staff.find((s:any)=>s.id===own.id).duty_status,state);
  checks.push(`Manager sees saved ${state} after explicit refresh`);
}
async function persisted(page:Page,status:string){
  const data=await read(page,`/shops/${shopId}`),visit=data.visits.find((v:any)=>v.id===visitId),follow=data.followups.find((f:any)=>f.id===followupId);
  assert.equal(visit.lifecycle,"completed");assert.equal(visit.notes,note);assert.equal(follow.status,status);assert.equal(follow.owner_id,own.id);
  assert.equal(data.followups.filter((f:any)=>f.visit_id===visitId).length,1);
}
async function download(kind:string,format:string,scope:string){
  const event=manager!.waitForEvent("download");await manager!.locator(`[data-manager-export=${format}]`).click();const file=await event;assert.equal(await file.failure(),null);
  const path=`${out}/${scope}-${kind}.${format}`;await file.saveAs(path);const bytes=await readFile(path);assert.equal(bytes.subarray(0,format==="pdf"?5:2).toString(),format==="pdf"?"%PDF-":"PK");
  let rows:number|undefined;
  if(format==="xlsx"){
    const book=new ExcelJS.Workbook();await book.xlsx.readFile(path);const sheet=book.getWorksheet("Report")!;rows=sheet.rowCount-5;
    assert.ok(sheet.getCell("A2").text.includes(today));assert.ok(sheet.getCell("A3").text.includes(scope==="all-staff"?"All sales executives":own.name));
    assert.ok(sheet.getCell("A4").text.length>0);
    if(scope==="all-staff"){
      const text=sheet.getSheetValues().flat(2).map(String).join(" ");assert.ok(text.includes("أحمد حسن"));assert.ok(text.includes("നസീർ മുഹമ്മദ്"));assert.ok(text.includes("D’Souza Tools"));
      const expected=await read(manager!,`/reports/activity?from=${today}&to=${today}`);assert.equal(rows,expected.total);
    }
    if(kind==="duty")assert.ok(book.getWorksheet("Break history")!.rowCount>1);
  }
  downloads.push({kind,format,scope,path,bytes:bytes.length,rows});
}
try{
  let executiveContext=await browser.newContext({viewport:{width:390,height:844}});exec=await login(executiveContext,"ahmed");
  const me=await read(exec,"/me"),dashboard=await read(exec,"/dashboard"),duty=await read(exec,"/duty");
  assert.equal(me.actor.role,"executive");assert.equal(me.policies.visit,"approved-v2");assert.equal(me.policies.duty,"approved-v1");
  assert.ok(!dashboard.active.some((v:any)=>v.visitor_id===own.id),"Existing open visit: preserve it and finish the test later");
  assert.ok(!duty.sessions.some((s:any)=>s.executive_id===own.id&&!s.ended_at),"Existing duty: preserve it and finish the test later");
  assert.equal((await read(exec,`/shops/${shopId}`)).shop.synthetic,true);
  await exec.getByRole("button",{name:"Start duty",exact:true}).click();await exec.getByRole("button",{name:"End duty",exact:true}).waitFor();
  dutyId=(await read(exec,"/duty")).sessions.find((s:any)=>!s.ended_at).id;checks.push("Executive signs in and starts separate duty");
  const managerContext=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});manager=await login(managerContext,"manager");await loaded(manager);
  await staffState("On duty");for(const width of widths)await shot(manager,"manager","on-duty",width);
  await shop(exec);await exec.getByRole("button",{name:"Check in to this shop",exact:false}).click();await exec.locator("[data-checkout]").waitFor();visitId=(await exec.locator("[data-checkout]").getAttribute("data-checkout"))!;
  await exec.locator("[data-checkout]").click();await exec.getByLabel("What did you discuss?",{exact:false}).fill(note);await exec.getByLabel("Visit outcome",{exact:false}).selectOption("Regular Visit");await shot(exec,"executive","checkout",390);
  await exec.getByRole("button",{name:"Check Out · Save Visit",exact:true}).click();await exec.locator("#dialog").waitFor({state:"hidden"});await exec.getByText("Visit completed and saved.",{exact:true}).waitFor();
  await exec.getByRole("button",{name:"Add follow-up",exact:true}).click();await exec.getByLabel("Follow-up date",{exact:false}).fill(today);await exec.getByLabel("For your visit on",{exact:false}).selectOption(visitId);await exec.getByRole("button",{name:"Save follow-up",exact:true}).click();await exec.locator("#dialog").waitFor({state:"hidden"});
  followupId=(await read(exec,`/shops/${shopId}`)).followups.find((f:any)=>f.visit_id===visitId).id;await persisted(exec,"pending");
  for(const width of widths)await shot(exec,"executive","pending-followup",width);checks.push("Executive searches, checks in, selects outcome, checks out and sets exactly one independent follow-up");
  await manager.getByRole("button",{name:"Show activity",exact:true}).click();await loaded(manager);
  for(const format of ["xlsx","pdf"])await download("activity",format,"all-staff");
  await manager.getByLabel("From",{exact:true}).fill(addDays(today,-1));await manager.getByLabel("To",{exact:true}).fill(today);await manager.getByLabel("Sales executive",{exact:true}).selectOption(own.id);await manager.getByRole("button",{name:"Show activity",exact:true}).click();await loaded(manager);
  const selected=await read(manager,`/reports/activity?from=${addDays(today,-1)}&to=${today}&person=${own.id}`);assert.ok(selected.rows.some((v:any)=>v.id===visitId));assert.ok(selected.rows.every((v:any)=>v.visitor_id===own.id));await shot(manager,"manager","date-person-filter",1440);checks.push("Manager filters by salesman and two UAE business dates");
  await manager.getByRole("button",{name:"Today",exact:true}).click();await loaded(manager);
  for(const kind of ["activity","duty","followups"]){await manager.locator(`[data-manager-kind=${kind}]`).click();await loaded(manager);for(const format of ["xlsx","pdf"])await download(kind,format,"selected-staff");}
  const pending=await read(manager,`/reports/followups?from=${today}&to=${today}&person=${own.id}&scope=outstanding`);assert.ok(pending.rows.some((f:any)=>f.id===followupId));checks.push("Manager reviews pending follow-up and downloads eight populated Excel/PDF files including multilingual all-staff activity");
  await exec.locator(`[data-followup="${followupId}"][data-action=complete]`).click();await exec.getByLabel("Completion note",{exact:false}).fill("Called customer and sent the quotation.");await exec.getByRole("button",{name:"Save follow-up",exact:true}).click();await exec.locator("#dialog").waitFor({state:"hidden"});await persisted(exec,"completed");await shot(exec,"executive","completed-followup",390);
  await exec.reload();await shop(exec);await persisted(exec,"completed");await exec.getByRole("button",{name:"Sign out",exact:true}).click();await executiveContext.close();
  executiveContext=await browser.newContext({viewport:{width:390,height:844}});exec=await login(executiveContext,"ahmed");await shop(exec);await persisted(exec,"completed");checks.push("Completed follow-up and visit persist through refresh and fresh executive login");
  await manager.locator("[data-manager-follow-status]").selectOption("completed");await loaded(manager);const completed=await read(manager,`/reports/followups?from=${today}&to=${today}&person=${own.id}&scope=range&status=completed`);assert.ok(completed.rows.some((f:any)=>f.id===followupId));await shot(manager,"manager","completed-followups",1440);
  await shop(manager);await persisted(manager,"completed");await shot(manager,"manager","customer-history",1440);await navigate(manager,"dashboard");await loaded(manager);
  await navigate(exec,"dashboard");await exec.getByRole("button",{name:"Start break",exact:true}).click();await exec.getByRole("button",{name:"Return to duty",exact:true}).waitFor();await staffState("On break");await shot(manager,"manager","on-break",390);
  await exec.getByRole("button",{name:"Return to duty",exact:true}).click();await exec.getByRole("button",{name:"End duty",exact:true}).waitFor();await staffState("On duty");
  await exec.getByRole("button",{name:"End duty",exact:true}).click();await exec.getByRole("button",{name:"Start duty",exact:true}).waitFor();await staffState("Off duty");await shot(manager,"manager","off-duty",1440);
  const ended=await read(exec,"/duty");assert.ok(ended.sessions.find((s:any)=>s.id===dutyId).ended_at);assert.equal(ended.rests.filter((r:any)=>r.session_id===dutyId&&r.ended_at).length,1);checks.push("Executive break, return and end are saved with manager visibility of each state");
  await exec.getByRole("button",{name:"Sign out",exact:true}).click();await executiveContext.close();await manager.getByRole("button",{name:"Sign out",exact:true}).click();await managerContext.close();
  const freshManagerContext=await browser.newContext({viewport:{width:1440,height:1000}});manager=await login(freshManagerContext,"manager");await loaded(manager);await shop(manager);await persisted(manager,"completed");await manager.getByRole("button",{name:"Sign out",exact:true}).click();await freshManagerContext.close();checks.push("Fresh manager login retains completed shared customer history");
  assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({status:"passed",executedAt:new Date().toISOString(),sourceCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),origin,scope:"Synthetic local browser emulation, not human or physical-device acceptance",checks,layouts,downloads,errors,records:{visitId,followupId,dutyId,visit:"completed",followup:"completed",duty:"ended"}},null,2));
  console.log(`${checks.length} local acceptance checkpoints passed; ${downloads.length} native downloads; live duty states, follow-up completion, refresh/fresh-login persistence and five widths verified.`);
}catch(error){await exec?.screenshot({path:`${out}/failure-executive.png`,fullPage:true}).catch(()=>{});await manager?.screenshot({path:`${out}/failure-manager.png`,fullPage:true}).catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({checks,errors,error:String(error),records:{visitId,followupId,dutyId}},null,2));throw error;}
finally{await browser.close();}
