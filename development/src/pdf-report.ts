import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openSync, type Font } from "fontkit";
import { chromium } from "playwright";
import { Fault } from "./domain.js";
import type { DownloadReport } from "./report-downloads.js";

const fontFiles=["NotoSans-Regular.ttf","NotoSans-Bold.ttf","NotoSansArabic-Regular.ttf","NotoSansMalayalam-Regular.ttf"];
const fonts=fontFiles.map(file=>{
  const path=new URL(`../assets/fonts/${file}`,import.meta.url);
  return {font:openSync(fileURLToPath(path)) as Font,data:readFileSync(path).toString("base64")};
});
const escape=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
let active=0;

/** Local, network-isolated browser layout supplies Unicode shaping, bidi and font fallback.
 * Authorization and a repeatable-read database snapshot happen before this serialization. */
export async function renderPdf(report:DownloadReport,context:string):Promise<Buffer>{
  const values=[report.title,context,report.totals,...report.notes,...report.columns.map(c=>c.label),...report.rows.flatMap(r=>report.columns.map(c=>r[c.key]))];
  for(const value of values)for(const char of String(value??"").normalize("NFC")){
    if(!/^[\n\r\t\u200c\u200d]$/u.test(char)&&!fonts.some(f=>f.font.hasGlyphForCodePoint(char.codePointAt(0)!)))
      throw new Fault(422,"PDF_FONT_UNSUPPORTED","This PDF supports Latin, Arabic and Malayalam text. Another character needs an additional font. Download Excel to keep the full text.");
  }
  if(active>=2)throw new Fault(503,"PDF_BUSY","Two reports are being prepared. Please try the PDF download again shortly.");
  active++;
  let browser;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try{
    try{browser=await chromium.launch({headless:true,timeout:30000});}
    catch{throw new Fault(503,"PDF_UNAVAILABLE","PDF preparation is unavailable. Download Excel, or ask the local administrator to run the PDF setup in the run instructions.");}
    const page=await browser.newPage({javaScriptEnabled:false});
    await page.route("**/*",route=>route.abort());
    const weights=report.columns.map(c=>/notes|reason/i.test(c.label)?2.1:/shop/i.test(c.label)?1.65:/date|time|start|end/i.test(c.label)?1.25:1);
    const totalWeight=weights.reduce((a,b)=>a+b,0);
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:"><title>${escape(report.title)}</title><style>
      ${fonts.map((font,i)=>`@font-face{font-family:'${i<2?"Noto":"Noto"+i}';font-style:normal;font-weight:${i===1?700:400};src:url(data:font/ttf;base64,${font.data}) format('truetype');font-display:block}`).join("")}
      *{box-sizing:border-box}body{font-family:'Noto','Noto2','Noto3',sans-serif;font-size:9pt;line-height:1.55;color:#202b25;margin:0}
      h1{font-size:16pt;color:#164d3c;margin:0 0 3pt}h2{font-size:12pt;margin:0 0 6pt}p{margin:3pt 0}.context{font-size:9pt}.notes{font-size:8pt;color:#606b64;margin:7pt 0 12pt}.totals{font-weight:700;margin:7pt 0}
      table{border-collapse:collapse;table-layout:fixed;width:100%;font-size:8pt;line-height:1.7}thead{display:table-header-group}tr{break-inside:avoid}tr.long-record{break-inside:auto}.repeat-context td{background:white;color:#606b64;padding:4pt 0 8pt;font-size:8pt;border:0;font-weight:400}th{text-align:left;background:#164d3c;color:white;font-weight:700}td,th{padding:6pt;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}td{border-bottom:0.5pt solid #dce5de}tbody tr:nth-child(even){background:#f1f6f2}bdi{unicode-bidi:plaintext}.empty{padding:20pt;color:#606b64}
    </style></head><body><h1>EMERALD INTERLINK</h1><h2>${escape(report.title)}</h2><p>${escape(report.from)} to ${escape(report.to)} | ${escape(report.timeZone)} | ${report.total} records</p><p class="context"><bdi dir="auto">${escape(context)}</bdi></p>${report.totals?`<p class="totals">${escape(report.totals)}</p>`:""}<p class="notes">${escape(report.notes.join(" "))}</p><table><colgroup>${weights.map(w=>`<col style="width:${w/totalWeight*100}%">`).join("")}</colgroup><thead><tr class="repeat-context"><td colspan="${report.columns.length}"><bdi dir="auto">${escape(`${report.title} | ${report.from} to ${report.to} | ${report.timeZone} | ${report.total} records | ${context}`)}</bdi></td></tr><tr>${report.columns.map(c=>`<th>${escape(c.label)}</th>`).join("")}</tr></thead><tbody>${report.rows.map(row=>`<tr class="${report.columns.some(c=>String(row[c.key]??"").length>400||String(row[c.key]??"").split("\n").length>12)?"long-record":""}">${report.columns.map(c=>`<td><bdi dir="auto">${escape(row[c.key])}</bdi></td>`).join("")}</tr>`).join("")}</tbody></table>${report.rows.length?"":'<p class="empty">No records match the selected dates and staff.</p>'}</body></html>`;
    await page.setContent(html,{waitUntil:"load",timeout:30000});
    await page.evaluate(()=>document.fonts.ready);
    return await Promise.race([page.pdf({format:"A4",landscape:true,printBackground:true,displayHeaderFooter:true,headerTemplate:"<span></span>",footerTemplate:'<div style="font:8px sans-serif;color:#606b64;width:100%;text-align:right;padding:0 36px">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',margin:{top:"0.39in",bottom:"0.5in",left:"0.5in",right:"0.5in"}}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Fault(503,"PDF_TIMEOUT","This PDF took too long to prepare. Choose fewer dates or download Excel.")),30000);})]);
  }finally{clearTimeout(timer);try{await browser?.close();}finally{active--;}}
}
