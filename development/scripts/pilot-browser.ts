/** Local synthetic browser verification. Never uses client files or hosted services. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { openDatabase, migrate } from "../src/database.js";
import { seedSynthetic } from "../src/fixtures.js";
import { application } from "../src/server.js";
import type { Config } from "../src/config.js";
import { businessDay } from "../src/domain.js";

const db=await openDatabase(); await migrate(db); const fixture=await seedSynthetic(db,36);
const config:Config={host:"127.0.0.1",port:0,origin:"http://127.0.0.1",dataDir:"",secure:false,visitPolicy:"approved-v2",dutyPolicy:"approved-v1"};
const server=application(db,config); await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
config.origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
const browser=await chromium.launch({channel:"msedge",headless:true});
const evidence=".local/pilot-real-data/evidence"; await mkdir(evidence,{recursive:true});
try {
  for (const width of [390,430,768,1024,1440]) {
    const ctx=await browser.newContext({viewport:{width,height:900}}), page=await ctx.newPage();
    const errors:string[]=[]; page.on("pageerror",e=>errors.push(e.message));
    const manager=fixture.accounts.find(a=>a.role==="manager")!;
    await page.goto(config.origin); await page.getByLabel("Email",{exact:true}).fill(manager.email); await page.getByLabel("Password",{exact:true}).fill(manager.password);
    await page.getByRole("button",{name:"Sign in",exact:true}).click(); await page.getByRole("heading",{name:"Daily activity"}).waitFor();
    await page.getByRole("heading",{name:"Customers and enquiries"}).waitFor();
    await page.screenshot({path:`${evidence}/manager-${width}.png`,fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
    const nav=await page.locator("#mobileNav").isVisible()?"#mobileNav":"#desktopNav";
    await page.locator(`${nav} [data-view="leads"]`).click();
    await page.getByRole("heading",{name:"Enquiries",exact:true}).first().waitFor();
    await page.locator("[data-shop]").first().click();
    await page.getByRole("button",{name:"Convert to customer"}).waitFor();
    await page.screenshot({path:`${evidence}/enquiry-${width}.png`,fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`enquiry overflow at ${width}`);
    if(width===390) {
      await page.getByRole("button",{name:"Update enquiry status"}).click();
      const select=page.locator("#field-status");
      const current=await select.inputValue(); await select.selectOption(current==="Contacted"?"Interested":"Contacted");
      await page.getByRole("button",{name:"Save status"}).click(); await page.locator("#dialog").waitFor({state:"hidden"});
      page.once("dialog",dialog=>dialog.accept()); await page.getByRole("button",{name:"Convert to customer"}).click();
      await page.getByText("Enquiry converted to customer.").waitFor();
      await page.getByRole("button",{name:"Convert to customer"}).waitFor({state:"detached"});
      assert.equal(await page.getByRole("button",{name:"Convert to customer"}).count(),0);
    }
    assert.deepEqual(errors,[]); await ctx.close();
    const exec=fixture.accounts.find(a=>a.email==="ahmed@local.invalid")!;
    const ectx=await browser.newContext({viewport:{width,height:900}}), ep=await ectx.newPage();
    await ep.goto(config.origin); await ep.getByLabel("Email",{exact:true}).fill(exec.email); await ep.getByLabel("Password",{exact:true}).fill(exec.password);
    await ep.getByRole("button",{name:"Sign in",exact:true}).click(); await ep.getByRole("heading",{name:"Your working day"}).waitFor();
    if(width===390) { await ep.getByRole("button",{name:"Start duty",exact:true}).click(); await ep.getByRole("button",{name:"Start break",exact:true}).waitFor(); }
    await ep.screenshot({path:`${evidence}/executive-${width}.png`,fullPage:true});
    assert.ok(await ep.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`executive overflow at ${width}`);
    const enav=await ep.locator("#mobileNav").isVisible()?"#mobileNav":"#desktopNav";
    await ep.locator(`${enav} [data-view="shops"]`).click(); await ep.getByRole("heading",{name:"Customers",exact:true}).first().waitFor();
    await ep.locator(`${enav} [data-view="leads"]`).click(); await ep.getByRole("heading",{name:"Enquiries",exact:true}).first().waitFor();
    if(width===390) {
      const lead=(await db.query<{id:string}>("SELECT id FROM shops WHERE organization_id=$1 AND assigned_executive_id=$2 AND status<>'Customer' LIMIT 1",[fixture.organizationId,exec.id])).rows[0];
      assert.ok(lead); await ep.locator(`[data-shop="${lead.id}"]`).first().click();
      await ep.getByRole("button",{name:"Update enquiry status"}).waitFor();
      assert.equal(await ep.getByRole("button",{name:"Convert to customer"}).count(),0);
      await ep.getByRole("button",{name:/Check in to this shop/}).click(); await ep.locator("[data-checkout]").waitFor();
      await ep.locator("[data-checkout]").click(); await ep.getByLabel("What did you discuss?",{exact:false}).fill("Fictional enquiry discussion.");
      await ep.getByLabel("Follow-up date (optional)",{exact:false}).fill(businessDay(new Date()));
      await ep.getByRole("button",{name:"Check Out · Save Visit"}).click(); await ep.locator("#dialog").waitFor({state:"hidden"});
      await ep.reload(); await ep.getByRole("heading",{name:"Your working day"}).waitFor();
      const saved=(await db.query<{notes:string;n:number}>("SELECT v.notes,(SELECT count(*)::int FROM followups f WHERE f.visit_id=v.id) AS n FROM visits v WHERE v.organization_id=$1 AND v.shop_id=$2 AND v.visitor_id=$3 ORDER BY v.checked_in_at DESC LIMIT 1",[fixture.organizationId,lead.id,exec.id])).rows[0];
      assert.equal(saved.notes,"Fictional enquiry discussion."); assert.equal(saved.n,1);
      await ep.getByRole("button",{name:"Start break",exact:true}).click(); await ep.getByRole("button",{name:"Return to duty",exact:true}).click();
      await ep.getByRole("button",{name:"End duty",exact:true}).click(); await ep.getByRole("button",{name:"Start duty",exact:true}).waitFor();
      const mc=await browser.newContext({viewport:{width,height:900}}), mp=await mc.newPage();
      await mp.goto(config.origin); await mp.getByLabel("Email",{exact:true}).fill(manager.email); await mp.getByLabel("Password",{exact:true}).fill(manager.password); await mp.getByRole("button",{name:"Sign in",exact:true}).click();
      await mp.getByRole("heading",{name:"Daily activity"}).waitFor();
      const mnav=await mp.locator("#mobileNav").isVisible()?"#mobileNav":"#desktopNav";
      await mp.locator(`${mnav} [data-view="leads"]`).click(); await mp.locator(`[data-shop="${lead.id}"]`).first().click();
      await mp.getByText("Fictional enquiry discussion.").waitFor(); await mc.close();
    }
    await ectx.close(); console.log(`PASS synthetic manager and executive ${width}px`);
  }
} finally { await browser.close(); await new Promise<void>(r=>server.close(()=>r())); await db.close(); }
