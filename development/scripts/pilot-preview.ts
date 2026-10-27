/** Local preview only: prints counts and writes issue references, never workbook cell values. */
import { readFile, writeFile } from "node:fs/promises";
import { preparePilotWorkbooks, reviewIssueKey } from "../src/pilot-workbooks.js";

const [customerPath,leadPath,outputPath] = process.argv.slice(2);
if (!customerPath || !leadPath || !outputPath) {
  console.error("Usage: pilot-preview <customer.xlsx> <leads.xlsx> <private-report.json>");
  process.exitCode=1;
} else {
  try {
    const prepared=await preparePilotWorkbooks(await readFile(customerPath),await readFile(leadPath));
    const report={hashes:prepared.hashes,sourceHash:prepared.sourceHash,
      customers:prepared.rows.filter(r=>r.kind === "customer").length,
      leads:prepared.rows.filter(r=>r.kind === "lead").length,
      issueCount:prepared.issues.length,issues:prepared.issues.map(i=>({...i,key:reviewIssueKey(i)}))};
    await writeFile(outputPath,JSON.stringify(report,null,2)+"\n",{flag:"wx",mode:0o600});
    console.log(`Private preview written: ${report.customers} customers, ${report.leads} leads, ${report.issueCount} review flags. No data imported.`);
  } catch (error) {
    // Only our fixed validation errors are safe; library errors may contain cell contents or paths.
    console.error("Preview failed. Check workbook structure, private output location and input files.");
    process.exitCode=1;
  }
}
