import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { preparePilotWorkbooks, importReviewedWorkbooks, reviewIssueKey } from "../src/pilot-workbooks.js";
import { openDatabase, migrate } from "../src/database.js";
import { createAccount } from "../src/auth.js";
import type { Actor } from "../src/domain.js";

async function files() {
  const c=new ExcelJS.Workbook(), l=new ExcelJS.Workbook();
  const cs=c.addWorksheet("CSTMR"), ls=l.addWorksheet("Sheet1");
  cs.addRow(["SN","Display Name","Phone","Billing City","Billing State","Billing Country","Owner Name","Primary Contact ID","Tax Registration Number","VAT Treatment"]);
  cs.addRow([1,"Fictional One","001234567","Area","Emirate","Country","SALESPERSON A","synthetic-id","sensitive-test-tax",""]);
  ls.addRow(["","SN","PARTY NAME","AREA","STATE","SALES PERSON","CONTACT NO","WHATSSUP NO","CNTCT PRSN NAME"]);
  ls.addRow(["",1,"Fictional One","Area","Emirate","",123456,"",{formula:"1/0",result:{error:"#DIV/0!"}}]);
  ls.getRow(2).getCell(7).numFmt="00000000";
  return [Buffer.from(await c.xlsx.writeBuffer()),Buffer.from(await l.xlsx.writeBuffer())] as const;
}
test("Excel review binds source bytes, preserves cells and requires explicit exception decisions", async () => {
  const [c,l]=await files(), p=await preparePilotWorkbooks(c,l);
  assert.equal(p.rows.length,2); assert.equal(p.rows[0].phone,"001234567");
  assert.equal(p.rows[1].phone,"123456"); assert.equal(p.rows[1].phoneFormat,"00000000");
  assert.ok(p.issues.some(i=>i.code==="numeric_phone"));
  assert.ok(p.issues.some(i=>i.code==="customer_name_match"));
  assert.ok(p.issues.some(i=>i.code==="formula_unusable"));
  assert.ok(!JSON.stringify(p.issues).includes("sensitive-test-tax"));
  const db=await openDatabase();
  try {
    await migrate(db); const org=randomUUID();
    await db.query("INSERT INTO organizations(id,name) VALUES($1,'Fictional pilot')",[org]);
    const mid=await createAccount(db,org,"manager@synthetic.invalid","Manager","manager","test-only-password-12345");
    const eid=await createAccount(db,org,"staff@synthetic.invalid","Staff","executive","test-only-password-12345");
    const actor:Actor={id:mid,organizationId:org,role:"manager",name:"Manager"};
    const approval={sourceHash:p.sourceHash,customers:1,leads:1,owners:{"SALESPERSON A":eid},unassignedRows:[2],reviewedIssues:p.issues.map(reviewIssueKey),acceptedBlankCells:p.issues.filter(i=>i.code==="formula_unusable").map(reviewIssueKey)};
    await assert.rejects(()=>importReviewedWorkbooks(db,actor,c,l,{...approval,acceptedBlankCells:[]}),/explicit decision/);
    await assert.rejects(()=>importReviewedWorkbooks(db,actor,c,l,{...approval,reviewedIssues:[]}),/review issue/);
    await assert.rejects(()=>importReviewedWorkbooks(db,actor,c,l,{...approval,sourceHash:"0".repeat(64)}),/source files have changed/);
    await assert.rejects(()=>importReviewedWorkbooks(db,actor,c,l,{...approval,unassignedRows:[]}),/Unassigned lead rows/);
    await assert.rejects(()=>importReviewedWorkbooks(db,actor,c,l,{...approval,owners:{}}),/mapping missing/);
    const first=await importReviewedWorkbooks(db,actor,c,l,approval), replay=await importReviewedWorkbooks(db,actor,c,l,approval);
    assert.equal(first.batchId,replay.batchId); assert.equal(replay.replay,true);
    const stored=(await db.query<{status:string;phone:string;assigned_executive_id:string|null;phone_format:string;review_codes:string[]}>("SELECT s.status,s.phone,s.assigned_executive_id,r.phone_format,r.review_codes FROM shops s JOIN import_source_rows r ON r.shop_id=s.id WHERE s.organization_id=$1 ORDER BY s.status",[org])).rows;
    assert.equal(stored.length,2); assert.equal(stored[1].assigned_executive_id,null);
    assert.equal(stored[1].phone_format,"00000000");
    assert.ok(stored[1].review_codes.some(code=>code.includes("formula_unusable")));
  } finally { await db.close(); }
});
