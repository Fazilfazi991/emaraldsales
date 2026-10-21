import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,extname,relative,isAbsolute,join} from "node:path";
import assert from "node:assert/strict";
import {chromium,type Page} from "playwright";
import ExcelJS from "exceljs";
const root=resolve("../client-demo/dist"),out=resolve("evidence/client-demo");await mkdir(out,{recursive:true});
const config=JSON.parse(await readFile(resolve("../client-demo/vercel.json"),"utf8"));
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url!,"http://localhost").pathname,path=resolve(root,"."+(pathname==="/"?"/index.html":decodeURIComponent(pathname))),rel=relative(root,path);
  if(rel.startsWith("..")||isAbsolute(rel)){res.writeHead(404).end();return;}
  try{const data=await readFile(path);res.writeHead(200,{"Content-Type":({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".ttf":"font/ttf"} as Record<string,string>)[extname(path)]??"application/octet-stream",...Object.fromEntries(config.headers[0].headers.map((h:any)=>[h.key,h.value]))});res.end(data);}catch{res.writeHead(404).end();}
});
if(!process.env.DEMO_BASE_URL)await new Promise<void>(yes=>server.listen(0,"127.0.0.1",yes));
const base=process.env.DEMO_BASE_URL??`http://127.0.0.1:${(server.address() as any).port}`;
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const errors:string[]=[],unexpected:string[]=[],failures:string[]=[],checks:string[]=[];
function observe(page:Page){page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});page.on("request",r=>{const u=new URL(r.url());if((u.protocol==="http:"||u.protocol==="https:")&&(u.origin!==new URL(base).origin||u.pathname.startsWith("/api")))unexpected.push(r.url());});page.on("response",r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});}
context.on("page",observe);
await context.addInitScript(()=>{Object.defineProperty(navigator,"geolocation",{value:{getCurrentPosition(){throw new Error("Demo requested GPS");}}});});
const page=await context.newPage();
const mark=(name:string)=>{checks.push(name);console.log("PASS "+name);};
const visible=(selector:string)=>page.locator(selector).filter({visible:true}).first();
const nav=async(view:string)=>{await visible(`[data-view="${view}"]`).click();};
async function stable(){await page.waitForFunction(()=>!document.querySelector("#content[aria-busy=true]"));}
async function screen(name:string){await page.screenshot({path:join(out,name+".png"),fullPage:page.viewportSize()!.width>=700});}
async function selectRole(index:number){await page.locator("[data-demo-profile]").nth(index).click();await stable();}
async function switchRole(index:number){await visible("[data-logout]").click();await page.getByRole("heading",{name:"Choose your demo role"}).waitFor();await selectRole(index);}
try{
  await page.goto(base,{waitUntil:"networkidle"});await page.getByRole("heading",{name:"Choose your demo role"}).waitFor();await screen("role-selector-mobile");mark("Anonymous role selector opens without server sign-in");
  await selectRole(0);await page.getByRole("heading",{name:"Your working day"}).waitFor();
  await page.locator('[data-duty-action="start"]').click();await page.getByText("Your duty · On duty",{exact:true}).waitFor();mark("Executive starts duty");
  await page.getByRole("button",{name:"Search shops",exact:true}).click();await page.locator("#search").fill("Al Noor Building");await page.waitForTimeout(350);await stable();await page.locator('[data-shop]').filter({hasText:"Al Noor Building Materials"}).first().click();await stable();
  await page.locator("[data-checkin]").click();await page.locator("[data-checkout]").waitFor();mark("Shop search, history and check-in");
  await page.reload({waitUntil:"networkidle"});await page.getByRole("button",{name:"Open visit · Check out"}).click();await stable();await page.locator("[data-checkout]").click();
  await page.locator('[name="outcome"]').selectOption("Follow-up Required");await page.locator('[name="notes"]').fill("Fictional client demo discussion — മാതൃക — نموذج");
  const today=await page.evaluate(()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dubai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()));
  await page.locator('[name="followUpDate"]').fill(today);await page.getByRole("button",{name:"Check Out · Save Visit",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});await page.getByText("Visit completed and saved.",{exact:true}).waitFor();mark("Refresh retains open visit; checkout saves outcome and follow-up");
  const lastFollow=page.locator('.followup-item').filter({has:page.locator('[data-followup][data-action="reschedule"]')}).filter({hasText:today.slice(0,4)}).last();
  await lastFollow.locator('[data-action="reschedule"]').click();await page.locator('[name="dueDate"]').fill(today);await page.getByRole("button",{name:"Save follow-up",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});
  await page.locator('[data-followup][data-action="complete"]').last().click();await page.getByRole("button",{name:"Save follow-up",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});
  await page.locator("[data-add-followup]").click();await page.getByRole("button",{name:"Save follow-up",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});mark("Independent follow-up creation, reschedule and completion");
  await nav("dashboard");await page.locator('[data-duty-action="rest"]').click();await page.getByText("Your duty · On break",{exact:true}).waitFor();await page.reload({waitUntil:"networkidle"});await page.locator('[data-duty-action="return"]').click();await page.locator('[data-duty-action="end"]').click();await page.getByText("Your duty · Off duty",{exact:true}).waitFor();mark("Break, refresh, return and duty end persist");
  await page.waitForTimeout(5100);
  for(const width of [390,430,768,1024,1440]){await page.setViewportSize({width,height:width<700?844:1000});await screen(`executive-${width}`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Executive overflow at ${width}`);}mark("Executive layout at all five widths");
  await switchRole(3);await page.getByRole("heading",{name:"Daily activity",exact:true}).waitFor();await stable();await page.locator("[data-manager-kind]").first().waitFor();
  assert.ok(await page.getByText("Fictional client demo discussion",{exact:false}).count()===0); // Discussion is in shop history, not duplicated in overview.
  for(const width of [390,430,768,1024,1440]){await page.setViewportSize({width,height:width<700?844:1000});await screen(`manager-${width}`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Manager overflow at ${width}`);}mark("Manager layout at all five widths");
  for(const kind of ["activity","duty","followups"]){
    await page.locator(`[data-manager-kind="${kind}"]`).click();await page.waitForFunction(()=>!document.querySelector('[data-manager-filters] button[type=submit][disabled]'));
    const download=page.waitForEvent("download");await page.locator('[data-manager-export="xlsx"]').click();const file=await download,filename=join(out,file.suggestedFilename());await file.saveAs(filename);
    const book=new ExcelJS.Workbook();await book.xlsx.readFile(filename);assert.match(book.worksheets[0].getCell("A1").text,/DEMO.*Sample Data/);assert.ok(book.worksheets[0].rowCount>=8);
    if(kind==="activity"){const text=JSON.stringify(book.worksheets[0].getSheetValues());assert.match(text,/مؤسسة/);assert.match(text,/മാതൃക/);}
    const popup=context.waitForEvent("page");await page.locator('[data-manager-export="pdf"]').click();const print=await popup;await print.waitForLoadState("networkidle");await print.getByRole("button",{name:"Print / Save as PDF",exact:true}).waitFor();await print.evaluate(()=>document.fonts.ready);await print.pdf({path:join(out,`sample-${kind}.pdf`),preferCSSPageSize:true,printBackground:true});if(kind==="activity")await print.screenshot({path:join(out,"print-report.png"),fullPage:true});await print.close();
  }mark("All three Excel downloads parse; labelled print views generate real browser PDFs");
  await page.locator("#manager-person").selectOption({label:"Ahmed Hassan"});await page.getByRole("button",{name:"Show activity",exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-manager-filters] button[type=submit][disabled]'));await page.locator('[data-manager-kind="activity"]').click();await page.waitForFunction(()=>!document.querySelector('[data-manager-filters] button[type=submit][disabled]'));assert.equal(await page.locator('[data-manager-person]').count(),1);
  const yesterday=new Date(+new Date(today+"T12:00:00Z")-86400000).toISOString().slice(0,10);
  for(const field of ["#manager-from","#manager-to"])await page.locator(field).fill(yesterday);
  await page.getByRole("button",{name:"Show activity",exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-manager-filters] button[type=submit][disabled]'));assert.equal(await page.locator("[data-manager-shop]").count(),2);
  for(const field of ["#manager-from","#manager-to"])await page.locator(field).fill(today);
  await page.getByRole("button",{name:"Show activity",exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-manager-filters] button[type=submit][disabled]'));mark("Manager staff/date filtering and executive activity agree");
  await page.locator("[data-manager-shop]").filter({hasText:"Al Noor Building Materials"}).first().click();await page.getByText("Fictional client demo discussion — മാതൃക — نموذج",{exact:true}).waitFor();mark("Manager sees executive visit and shared customer history");
  await page.reload({waitUntil:"networkidle"});await page.getByRole("heading",{name:"Daily activity",exact:true}).waitFor();mark("Manager role and data persist after fresh page load");
  await switchRole(0);await nav("shops");await page.getByRole("button",{name:"＋ Add New Shop",exact:true}).click();await page.locator('[name="name"]').fill("Fictional Client Review Shop");await page.locator('[name="area"]').fill("Sample District");await page.getByRole("button",{name:"Save New Shop",exact:true}).click();await page.locator("#dialog").waitFor({state:"hidden"});await page.getByRole("heading",{name:"Fictional Client Review Shop",exact:true}).waitFor();mark("Executive adds a browser-local synthetic shop");
  page.once("dialog",d=>d.accept());await page.locator("[data-demo-reset]").click();await page.getByRole("heading",{name:"Choose your demo role"}).waitFor();await selectRole(0);await page.getByRole("button",{name:"Search shops",exact:true}).click();await page.locator("#search").fill("Fictional Client Review Shop");await page.waitForTimeout(350);assert.equal(await page.locator("[data-shop]").count(),0);await page.locator("#search").fill("");await page.waitForTimeout(350);await page.getByText("700 shops",{exact:true}).waitFor();mark("Reset restores 700 shops and clears role/workflow changes");
  assert.deepEqual(unexpected,[]);assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);mark("No API/database traffic, missing assets, GPS requests or browser errors");
  await writeFile(join(out,"verification.json"),JSON.stringify({base,at:new Date().toISOString(),checks,errors,unexpectedRequests:unexpected,failedResponses:failures,widths:[390,430,768,1024,1440],physicalPhoneTested:false,storage:"browser-local",sync:false},null,2));
}finally{await browser.close();if(server.listening)await new Promise<void>(yes=>server.close(()=>yes()));}
