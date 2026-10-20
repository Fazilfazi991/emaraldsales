import { chromium, type BrowserContext, type Page } from "playwright";
import ExcelJS from "exceljs";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { openDatabase, migrate, type Database, type Queryable } from "../src/database.js";
import { syntheticId } from "../src/fixtures.js";
import { seedDemonstration } from "../src/demo-fixtures.js";
import { application } from "../src/server.js";
import { businessDay, addDays } from "../src/domain.js";
import type { Config } from "../src/config.js";

const directory=await mkdtemp(join(tmpdir(),"emerald-phase2-browser-"));
const db=await openDatabase(join(directory,"database"));await migrate(db);
const fixture=await seedDemonstration(db);
let failAudit=false;
const wrapped:Database={query:db.query,close:async()=>{},transaction:work=>db.transaction(tx=>work({query:((sql:string,args?:unknown[])=>{if(failAudit&&sql.startsWith("INSERT INTO audit_events")){failAudit=false;throw new Error("QA browser synthetic database failure");}return tx.query(sql,args);}) as Queryable["query"]}))};
const settings:Config={host:"127.0.0.1",port:0,origin:"http://127.0.0.1",dataDir:directory,secure:false,visitPolicy:"approved-v2",dutyPolicy:"approved-v1"};
const server=application(wrapped,settings);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));settings.origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
const browser=await chromium.launch({channel:"msedge",headless:true});
const checks:string[]=[],errors:string[]=[],layouts:Record<string,unknown>[]=[],downloads:Record<string,unknown>[]=[];
const evidence=process.env.PHASE3_EVIDENCE ?? "evidence/phase3/after";await mkdir(evidence,{recursive:true});
const pass=(name:string)=>{checks.push(name);console.log(`PASS ${name}`);};
async function login(context:BrowserContext,slug:string){
  const a=fixture.accounts.find(a=>a.email===`${slug}@local.invalid`)!;const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(settings.origin);await page.getByLabel("Email",{exact:true}).fill(a.email);await page.getByLabel("Password",{exact:true}).fill(a.password);await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await page.getByRole("heading",{name:slug==="manager"?"Daily activity":"Your working day",exact:true}).waitFor();return page;
}
async function navigate(page:Page,view:string){await page.locator(`${await page.locator("#mobileNav").isVisible()?"#mobileNav":"#desktopNav"} [data-view="${view}"]`).click();}
async function shop(page:Page){await navigate(page,"shops");await page.getByLabel("Search shops",{exact:true}).fill("Al Noor Building Materials");await page.locator(".results").filter({hasText:"1 shops"}).waitFor();await page.locator("[data-shop]").filter({hasText:"Al Noor Building Materials"}).first().click();await page.getByRole("heading",{name:"Shop profile",exact:true}).waitFor();}
async function layout(page:Page,role:string,width:number,state:string){
  const observed=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  layouts.push({role,state,...observed});assert.ok(observed.scrollWidth<=width,`${role} ${width} ${state} has page overflow`);
  await page.screenshot({path:`${evidence}/${role}-${state}-${width}.png`,fullPage:true});
}
async function savedVisit(id:string){return(await db.query<any>("SELECT * FROM visits WHERE id=$1",[id])).rows[0];}
let lastPage:Page|undefined;
try{
  for(const width of [390,430,768,1024,1440]){
    const context=await browser.newContext({viewport:{width,height:1000}});const page=await login(context,"ahmed");lastPage=page;
    await navigate(page,"shops");await page.getByText("More filters",{exact:true}).click();await page.getByLabel("Filter by area",{exact:true}).selectOption({label:"Al Quoz"});
    await page.getByText("Filters · 1 active",{exact:true}).waitFor();assert.equal(await page.locator(".filter-options").getAttribute("open"),"");
    await page.getByText("Filters · 1 active",{exact:true}).click();await layout(page,"executive",width,"active-filter");
    await page.getByRole("button",{name:"Clear filters",exact:true}).click();await page.locator(".results").filter({hasText:"700 shops"}).waitFor();await navigate(page,"dashboard");
    pass(`${width}px active filter stays visible and clear filters restores 700 shops`);
    await page.getByRole("button",{name:"Start duty",exact:true}).click();await page.getByRole("button",{name:"End duty",exact:true}).waitFor();
    await layout(page,"executive",width,"day");
    await shop(page);await layout(page,"executive",width,"shop");
    await page.getByRole("button",{name:"Check in to this shop",exact:false}).click();await page.locator("[data-checkout]").waitFor();
    const own=fixture.accounts.find(a=>a.email==="ahmed@local.invalid")!;
    const visit=(await db.query<any>("SELECT * FROM visits WHERE visitor_id=$1 AND lifecycle='open'",[own.id])).rows[0];assert.ok(visit);
    if(width===390){
      const secondContext=await browser.newContext({viewport:{width:430,height:1000}});const second=await login(secondContext,"naseer");
      await shop(second);await second.getByRole("button",{name:"Check in to this shop",exact:false}).click();await second.locator("[data-checkout]").waitFor();
      await page.reload();await page.getByRole("heading",{name:"Your working day",exact:true}).waitFor();await shop(page);assert.equal(await page.locator("[data-checkout]").count(),1);
      await second.locator("[data-checkout]").click();await second.getByLabel("What did you discuss?",{exact:false}).fill("Separate executive visited same shop independently");await second.getByRole("button",{name:"Check Out · Save Visit",exact:true}).click();await second.locator("#dialog").waitFor({state:"hidden"});
      await secondContext.close();pass("390px separate executive same-shop visit does not hide own active visit");
    }
    await page.locator("[data-checkout]").click();await page.getByLabel("What did you discuss?",{exact:false}).fill(`Independent browser ${width}: <img src=x onerror=window.xssExecuted=true>`);
    await page.getByLabel("Follow-up date (optional)",{exact:false}).fill(businessDay(new Date()));
    await layout(page,"executive",width,"checkout");
    if(width===390){
      let dropped=false;const pattern="**/api/visits/*/checkout";
      await page.route(pattern,async route=>{if(!dropped){dropped=true;const r=await route.fetch();assert.equal(r.status(),200);await route.abort("failed");}else await route.continue();});
      await page.getByRole("button",{name:"Check Out · Save Visit",exact:true}).click();await page.getByRole("button",{name:"Retry save",exact:true}).waitFor();
      assert.equal((await savedVisit(visit.id)).lifecycle,"completed");await layout(page,"executive",width,"retry");
      await page.getByRole("button",{name:"Retry save",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});await page.unroute(pattern);
      assert.equal((await db.query<any>("SELECT count(*)::int n FROM followups WHERE visit_id=$1",[visit.id])).rows[0].n,1);pass("390px lost save acknowledgement retains visible safe retry and creates exactly one follow-up");
    }else if(width===430){
      failAudit=true;await page.getByRole("button",{name:"Check Out · Save Visit",exact:true}).click();await page.locator("#saveErrorDialog").waitFor({state:"visible"});
      assert.equal((await savedVisit(visit.id)).lifecycle,"open");assert.equal((await db.query<any>("SELECT count(*)::int n FROM followups WHERE visit_id=$1",[visit.id])).rows[0].n,0);
      await layout(page,"executive",width,"database-error");await page.getByRole("button",{name:"Retry save",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});pass("430px failed database save keeps visit open, preserves form, then retry succeeds");
    }else{await page.getByRole("button",{name:"Check Out · Save Visit",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});}
    assert.equal((await savedVisit(visit.id)).lifecycle,"completed");assert.equal(await page.locator(".visit-record img").count(),0);assert.equal(await page.evaluate(()=>Boolean((window as any).xssExecuted)),false);
    await page.getByRole("button",{name:"Add follow-up",exact:true}).click();await page.getByLabel("Follow-up date",{exact:false}).fill(businessDay(new Date()));await page.getByRole("button",{name:"Save follow-up",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});
    const follow=(await db.query<any>("SELECT * FROM followups WHERE visit_id=$1 ORDER BY created_at DESC,id",[visit.id])).rows;assert.equal(follow.length,2);
    const followCard=page.locator(".followup-item").filter({hasText:own.name}).filter({has:page.getByRole("button",{name:"Complete",exact:true})}).first();await followCard.getByRole("button",{name:"Reschedule",exact:true}).click();await page.getByLabel("New due date",{exact:false}).fill("2099-12-01");await page.getByLabel("Reason for this change",{exact:false}).fill("Customer requested December call");await page.getByRole("button",{name:"Save follow-up",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});
    await page.locator(`[data-followup="${follow[0].id}"][data-action=complete]`).click();await page.getByRole("button",{name:"Save follow-up",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});
    assert.equal((await db.query<any>("SELECT status FROM followups WHERE id=$1",[follow[0].id])).rows[0].status,"completed");
    await layout(page,"executive",width,"saved-history");await navigate(page,"dashboard");
    for(let interval=0;interval<3;interval++){await page.getByRole("button",{name:"Start break",exact:true}).click();await page.getByRole("button",{name:"Return to duty",exact:true}).click();await page.getByRole("button",{name:"End duty",exact:true}).waitFor();}
    await page.getByRole("button",{name:"End duty",exact:true}).click();await page.getByRole("button",{name:"Start duty",exact:true}).waitFor();
    if(width===1440){await navigate(page,"shops");await page.locator("[data-add]").click();await page.getByLabel("Shop name",{exact:false}).fill("Independent QA discovery");await page.locator("#dialog").getByLabel("Area",{exact:false}).fill("Al Quoz");await page.getByRole("button",{name:"Save New Shop",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});assert.equal((await db.query<any>("SELECT assigned_executive_id FROM shops WHERE name='Independent QA discovery'")).rows[0].assigned_executive_id,own.id);pass("1440px executive adds shop with sensible self-assignment");}
    await page.getByRole("button",{name:"Sign out",exact:true}).click();await page.getByRole("button",{name:"Sign in",exact:true}).waitFor();await context.close();
    const freshContext=await browser.newContext({viewport:{width,height:1000}});const fresh=await login(freshContext,"ahmed");await shop(fresh);await fresh.getByText(`Independent browser ${width}:`,{exact:false}).waitFor();
    assert.equal(await fresh.locator(`[data-followup="${follow[0].id}"][data-action=complete]`).count(),0);
    await fresh.reload();await shop(fresh);await fresh.getByText(`Independent browser ${width}:`,{exact:false}).waitFor();await fresh.getByRole("button",{name:"Sign out",exact:true}).click();await freshContext.close();
    pass(`${width}px saved visit and follow-up lifecycle survive refresh and fresh account login`);
    pass(`${width}px executive login, duty/break/return, search, checkin, checkout, independent follow-up, reschedule, complete, end duty and logout`);

    const managerContext=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});const manager=await login(managerContext,"manager");lastPage=manager;
    await manager.getByRole("heading",{name:"Staff activity",exact:true}).waitFor();await manager.locator("[data-manager-kind]").first().waitFor();await manager.getByText("Loading saved activity…",{exact:true}).waitFor({state:"hidden"});
    await layout(manager,"manager",width,"overview");
    if(width===390)assert.ok((await manager.locator(".kpis").boundingBox())!.y<844,"Daily totals should begin in the first mobile screen");
    const exportFrom=addDays(businessDay(new Date()),-180),exportTo=businessDay(new Date());
    await manager.getByLabel("From",{exact:true}).fill(exportFrom);await manager.getByLabel("To",{exact:true}).fill(exportTo);await manager.getByLabel("Sales executive",{exact:true}).selectOption(own.id);
    const directEvent=manager.waitForEvent("download");await manager.locator("[data-manager-export=xlsx]").click();const direct=await directEvent;assert.equal(await direct.failure(),null);const directPath=`${evidence}/manager-direct-filter-${width}.xlsx`;await direct.saveAs(directPath);
    const directBook=new ExcelJS.Workbook();await directBook.xlsx.readFile(directPath);const directSheet=directBook.getWorksheet("Report")!;
    const directExpected=await manager.evaluate(async filters=>await(await fetch(`/api/reports/activity?${new URLSearchParams(filters)}`)).json(),{from:exportFrom,to:exportTo,person:own.id});
    assert.equal(directSheet.rowCount,5+directExpected.total);assert.ok(directSheet.getCell(2,1).text.includes(`${exportFrom} to ${exportTo}`));for(let n=6;n<=directSheet.rowCount;n++)assert.equal(directSheet.getCell(n,1).text,own.name);
    downloads.push({width,format:"xlsx",directVisibleFilters:true,from:exportFrom,to:exportTo,rows:directExpected.total,filteredPerson:own.name,complete:true});
    await manager.getByRole("button",{name:"Today",exact:true}).click();await manager.getByText("Loading saved activity…",{exact:true}).waitFor({state:"hidden"});
    await manager.locator("[data-manager-kind=followups]").click();await manager.getByText("Loading saved activity…",{exact:true}).waitFor({state:"hidden"});await manager.getByRole("heading",{name:"Follow-up report",exact:true}).waitFor();await layout(manager,"manager",width,"followups");
    await manager.getByRole("combobox",{name:/Sales executive/}).selectOption(own.id);await manager.getByRole("button",{name:"Show activity",exact:true}).click();await manager.getByText("Loading saved activity…",{exact:true}).waitFor({state:"hidden"});
    await manager.locator("[data-manager-kind=activity]").click();await manager.getByText("Loading saved activity…",{exact:true}).waitFor({state:"hidden"});await layout(manager,"manager",width,"one-executive");
    for(const format of ["xlsx","pdf"]){
      const event=manager.waitForEvent("download");await manager.locator(`[data-manager-export=${format}]`).click();const download=await event;assert.equal(await download.failure(),null);const path=`${evidence}/manager-${width}.${format}`;await download.saveAs(path);const bytes=await readFile(path);assert.equal(bytes.subarray(0,format==="pdf"?5:2).toString(),format==="pdf"?"%PDF-":"PK");
      if(format==="xlsx"){const book=new ExcelJS.Workbook();await book.xlsx.readFile(path);const sheet=book.getWorksheet("Report")!;const data=await manager.evaluate(async person=>{const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dubai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());return(await(await fetch(`/api/reports/activity?from=${day}&to=${day}&person=${person}&pageSize=1`)).json());},own.id);assert.equal(sheet.rowCount,5+data.total);for(let n=6;n<=sheet.rowCount;n++)assert.equal(sheet.getCell(n,1).text,own.name);downloads.push({width,format,rows:data.total,filteredPerson:own.name,complete:true});}
      else downloads.push({width,format,signature:true});
    }
    for(const kind of ["duty","followups"]){
      await manager.locator(`[data-manager-kind=${kind}]`).click();await manager.getByText("Loading saved activity…",{exact:true}).waitFor({state:"hidden"});await layout(manager,"manager",width,kind);
      for(const format of ["xlsx","pdf"]){const event=manager.waitForEvent("download");await manager.locator(`[data-manager-export=${format}]`).click();const file=await event;assert.equal(await file.failure(),null);const target=`${evidence}/manager-${kind}-${width}.${format}`;await file.saveAs(target);if(format==="xlsx"){const book=new ExcelJS.Workbook();await book.xlsx.readFile(target);assert.ok(book.getWorksheet("Report")!.getCell("A3").text.includes(own.name));if(kind==="duty")assert.equal(book.getWorksheet("Break history")!.rowCount,width===390?4:([390,430,768,1024,1440].indexOf(width)+1)*3+1);}downloads.push({width,kind,format,populated:true});}
    }
    await manager.reload();await manager.getByRole("heading",{name:"Daily activity",exact:true}).waitFor();
    if(width===1440){
      await shop(manager);const target=fixture.accounts.find(a=>a.email==="naseer@local.invalid")!;
      await manager.locator(`[data-followup="${follow[1].id}"][data-action=assign]`).click();await manager.getByLabel("Assign to executive",{exact:false}).selectOption(target.id);await manager.getByLabel("Reason for this change",{exact:false}).fill("Manager approved route coverage");await manager.getByRole("button",{name:"Save follow-up",exact:true}).click();await manager.locator("#dialog").waitFor({state:"hidden"});
      assert.equal((await db.query<any>("SELECT owner_id FROM followups WHERE id=$1",[follow[1].id])).rows[0].owner_id,target.id);
      const previous=await db.query<any>("SELECT id,visitor_id,lifecycle,notes FROM visits WHERE shop_id=$1 ORDER BY id",[syntheticId("shop-1")]);
      const previousFollow=await db.query<any>("SELECT id,owner_id,status,version FROM followups WHERE shop_id=$1 ORDER BY id",[syntheticId("shop-1")]);
      await manager.getByText("Manage shop",{exact:true}).click();await manager.getByRole("button",{name:"Transfer shop",exact:true}).click();await manager.getByLabel("Assign shop to",{exact:false}).selectOption(target.id);await manager.getByLabel("Reason for this change",{exact:false}).fill("Manager approved explicit transfer");manager.once("dialog",dialog=>void dialog.accept());await manager.getByRole("button",{name:"Review transfer",exact:true}).click();await manager.locator("#dialog").waitFor({state:"hidden"});
      assert.equal((await db.query<any>("SELECT assigned_executive_id FROM shops WHERE id=$1",[syntheticId("shop-1")])).rows[0].assigned_executive_id,target.id);
      assert.deepEqual((await db.query<any>("SELECT id,visitor_id,lifecycle,notes FROM visits WHERE shop_id=$1 ORDER BY id",[syntheticId("shop-1")])).rows,previous.rows);assert.deepEqual((await db.query<any>("SELECT id,owner_id,status,version FROM followups WHERE shop_id=$1 ORDER BY id",[syntheticId("shop-1")])).rows,previousFollow.rows);
      await manager.getByRole("button",{name:"View record history",exact:true}).click();await manager.getByText("Manager approved explicit transfer",{exact:true}).waitFor();await manager.getByRole("button",{name:"Close",exact:true}).last().click();await layout(manager,"manager",width,"audited-transfer");
      pass("1440px manager assigns independent follow-up and explicitly confirms audited shop transfer without rewriting existing history");
    }
    await manager.getByRole("button",{name:"Sign out",exact:true}).click();await managerContext.close();
    pass(`${width}px manager daily attendance/completed/pending overview, follow-ups, one-executive filter, Excel/PDF downloads and refresh`);
  }
  assert.deepEqual(errors,[]);pass("no uncaught browser errors or executable untrusted notes");
  await writeFile(`${evidence}/browser.json`,JSON.stringify({executedAt:new Date().toISOString(),sourceCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),engine:"Microsoft Edge / Playwright",syntheticShopCount:700,checks,layouts,downloads,errors,usabilityScope:"Scripted label-based novice-path review; not independent first-time human usability research."},null,2));
}catch(error){await lastPage?.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});await writeFile(`${evidence}/browser-failure.json`,JSON.stringify({executedAt:new Date().toISOString(),checks,error:String(error),errors,layouts},null,2));throw error;}
finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();await rm(directory,{recursive:true,force:true});}
