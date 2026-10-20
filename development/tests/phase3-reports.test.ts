import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createServer} from "node:http";
import {pdfReport,type DownloadReport} from "../src/report-downloads.js";
const report:DownloadReport={kind:"activity",title:"Synthetic safety test",from:"2026-10-20",to:"2026-10-20",person:null,personName:null,timeZone:"Asia/Dubai",asOf:"2026-10-20T10:00Z",total:1,notes:[],columns:[{key:"name",label:"Shop"}],rows:[{name:"النور / മലബാർ / Élodie"}]};
test("Bundled fonts match pinned upstream hashes and retain the redistribution license",async()=>{
  const root=new URL("../assets/fonts/",import.meta.url);
  const manifest=JSON.parse(await readFile(new URL("manifest.json",root),"utf8"));
  for(const item of manifest){assert.match(item.url,/raw\.githubusercontent\.com\/notofonts\/noto-fonts\/[a-f0-9]{40}\//);assert.equal(createHash("sha256").update(await readFile(new URL(item.file,root))).digest("hex"),item.sha256);}
  assert.match(await readFile(new URL("OFL.txt",root),"utf8"),/SIL OPEN FONT LICENSE Version 1\.1/);
});
test("Untrusted report text cannot execute script or fetch network resources during PDF rendering",async()=>{
  let requests=0;const server=createServer((_,res)=>{requests++;res.end("Private network resource must never be fetched");});
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url=`http://127.0.0.1:${(server.address()as{port:number}).port}/private`;
  try{const pdf=await pdfReport({...report,rows:[{name:`<img src="${url}"><script>fetch('${url}')</script>`}]});assert.equal(pdf.subarray(0,5).toString(),"%PDF-");assert.equal(requests,0);}
  finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test("Concurrent PDF preparation is bounded and the busy slot recovers after completion",async()=>{
  const results=await Promise.allSettled([pdfReport(report),pdfReport(report),pdfReport(report)]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,2);
  const busy=results.find(r=>r.status==="rejected") as PromiseRejectedResult;assert.equal(busy.reason.code,"PDF_BUSY");
  assert.equal((await pdfReport(report)).subarray(0,5).toString(),"%PDF-");
});
