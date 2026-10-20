import {readFile,mkdir,writeFile} from "node:fs/promises";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
const origin="http://127.0.0.1:3100";
const credentials=JSON.parse(await readFile(".local/accounts.json","utf8"));
const account=credentials.accounts.find((p:{role:string})=>p.role==="manager");
const login=await fetch(origin+"/api/login",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({email:account.email,password:account.password})});
assert.equal(login.status,200);const session=await login.json(),cookie=login.headers.get("set-cookie")!.split(";")[0];
await mkdir("evidence/phase2/downloads",{recursive:true});
const results:Record<string,unknown>[]=[];
try{
  const dashboard=await(await fetch(origin+"/api/dashboard",{headers:{Cookie:cookie}})).json();
  const today=dashboard.metrics.day;
  for(const kind of ["activity","duty","followups"]){
    const query=new URLSearchParams({from:today,to:today,...(kind==="followups"?{scope:"outstanding"}:{})});
    const read=await fetch(`${origin}/api/reports/${kind}?${query}`,{headers:{Cookie:cookie}});assert.equal(read.status,200);const data=await read.json();
    for(const format of ["xlsx","pdf"]){
      const response=await fetch(`${origin}/api/reports/${kind}/export?${query}&format=${format}`,{headers:{Cookie:cookie}});assert.equal(response.status,200);
      const bytes=Buffer.from(await response.arrayBuffer());assert.ok(response.headers.get("content-disposition")?.includes(`.${format}`));
      if(format==="xlsx"){const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes as any);assert.equal(workbook.getWorksheet("Report")!.rowCount-5,data.total);}
      await writeFile(`evidence/phase2/downloads/${kind}.${format}`,bytes);
      results.push({kind,format,total:data.total,bytes:bytes.length});
    }
  }
  const range=new URLSearchParams({from:"2026-01-01",to:today,format:"pdf"});
  const full=await fetch(`${origin}/api/reports/activity/export?${range}`,{headers:{Cookie:cookie}});assert.equal(full.status,200);
  await writeFile("evidence/phase2/downloads/activity-multipage.pdf",Buffer.from(await full.arrayBuffer()));
  await writeFile("evidence/phase2/download-review.json",JSON.stringify({executedAt:new Date().toISOString(),origin,results,status:"passed",visualReview:"See rendered PDF pages; recorded separately"},null,2));
  console.log("Actual runtime: all six Excel/PDF downloads passed; Excel row counts reconcile to filtered API totals.");
}finally{await fetch(origin+"/api/logout",{method:"POST",headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/json","X-CSRF-Token":session.csrf},body:"{}"});}
