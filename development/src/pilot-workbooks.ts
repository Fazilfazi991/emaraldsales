/** Excel preparation only. No filesystem, database, network or logging side effects. */
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Database } from "./database.js";
import type { Actor } from "./domain.js";
import { importPilotBatch } from "./pilot-import.js";

type CellType = "empty" | "text" | "number";
type SourceRow = {
  kind: "customer" | "lead"; row: number; name: string; contact: string;
  phone: string; phoneType: CellType; phoneFormat: string;
  whatsapp: string; whatsappType: CellType; whatsappFormat: string;
  area: string; emirate: string; country: string; zohoId: string; ownerLabel: string;
};
type Issue = { kind: "customer" | "lead"; row: number; code: string; field?: string };
const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}_]+/gu, "");
const ownerKey = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
const digest = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
function cellValue(raw: ExcelJS.CellValue): unknown {
  if (raw && typeof raw === "object" && "formula" in raw) return raw.result;
  if (raw && typeof raw === "object" && "richText" in raw && Array.isArray(raw.richText)) return raw.richText.map(x=>x.text).join("");
  return raw;
}

function text(cell: ExcelJS.Cell, row: number, field: string): string {
  const raw = cell.value;
  const v = cellValue(raw);
  if (raw && typeof raw === "object" && "formula" in raw && (v == null || typeof v === "object")) return "";
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isSafeInteger(v)) return String(v);
  // Formula caches require explicit review; never evaluate formulas or use display formatting.
  throw new Error(`Unsupported cell in ${field}, row ${row}; review the original workbook.`);
}
function phone(cell: ExcelJS.Cell, row: number, field: string) {
  const raw = cell.value;
  const v = cellValue(raw);
  if (raw && typeof raw === "object" && "formula" in raw && (v == null || typeof v === "object")) return {value:"",type:"empty" as const,format:cell.numFmt ?? ""};
  if (v === null || v === undefined || v === "") return { value: "", type: "empty" as const, format: cell.numFmt ?? "" };
  if (typeof v === "string") return { value: v, type: "text" as const, format: cell.numFmt ?? "" };
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0)
    return { value: String(v), type: "number" as const, format: cell.numFmt ?? "" };
  throw new Error(`Unsupported phone cell in ${field}, row ${row}; review the original workbook.`);
}
function headers(sheet: ExcelJS.Worksheet, expected: Record<number, string>) {
  for (const [i, name] of Object.entries(expected))
    if (text(sheet.getRow(1).getCell(Number(i)), 1, "header").trim().toUpperCase() !== name)
      throw new Error(`Workbook header mismatch at column ${i}.`);
}
async function workbook(bytes: Buffer) {
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error("Workbook size is outside the permitted range.");
  const book = new ExcelJS.Workbook();
  try { await book.xlsx.load(bytes as any); } catch { throw new Error("Workbook could not be read as an Excel file."); }
  return book;
}
export async function preparePilotWorkbooks(customerBytes: Buffer, leadBytes: Buffer) {
  const [customers, leads] = await Promise.all([workbook(customerBytes), workbook(leadBytes)]);
  const cs = customers.getWorksheet("CSTMR"), ls = leads.getWorksheet("Sheet1");
  if (!cs || !ls) throw new Error("Expected customer or lead worksheet is missing.");
  headers(cs, {2:"DISPLAY NAME",3:"PHONE",4:"BILLING CITY",5:"BILLING STATE",6:"BILLING COUNTRY",7:"OWNER NAME",8:"PRIMARY CONTACT ID"});
  headers(ls, {3:"PARTY NAME",4:"AREA",5:"STATE",6:"SALES PERSON",7:"CONTACT NO",8:"WHATSSUP NO",9:"CNTCT PRSN NAME"});
  if (cs.rowCount > 10001 || ls.rowCount > 10001) throw new Error("Workbook exceeds the maximum row count.");
  const rows: SourceRow[] = [], issues: Issue[] = [];
  for (const [kind, sheet] of [["customer",cs],["lead",ls]] as const) {
    for (let n=2; n<=sheet.rowCount; n++) {
      const r=sheet.getRow(n);
      if (!r.hasValues) continue;
      for (const column of (kind === "customer" ? [2,3,4,5,6,7,8] : [3,4,5,6,7,8,9])) {
        const value = r.getCell(column).value;
        if (value && typeof value === "object" && "formula" in value)
          issues.push({kind,row:n,code:value.result == null || typeof value.result === "object" ? "formula_unusable" : "formula_cached_value",field:`column_${column}`});
      }
      const name=text(r.getCell(kind === "customer" ? 2 : 3),n,"name");
      const main=phone(r.getCell(kind === "customer" ? 3 : 7),n,"phone");
      const wa=kind === "lead" ? phone(r.getCell(8),n,"WhatsApp") : {value:"",type:"empty" as const,format:""};
      const item: SourceRow = {kind,row:n,name,contact:kind === "lead" ? text(r.getCell(9),n,"contact") : "",phone:main.value,phoneType:main.type,phoneFormat:main.format,whatsapp:wa.value,whatsappType:wa.type,whatsappFormat:wa.format,area:text(r.getCell(4),n,"area"),emirate:text(r.getCell(5),n,"emirate"),country:kind === "customer" ? text(r.getCell(6),n,"country") : "",zohoId:kind === "customer" ? text(r.getCell(8),n,"contact id") : "",ownerLabel:text(r.getCell(kind === "customer" ? 7 : 6),n,"owner").trim()};
      if (!name.trim()) issues.push({kind,row:n,code:"missing_name"});
      if (!item.ownerLabel) issues.push({kind,row:n,code:"unassigned"});
      if (!main.value.trim() && (kind === "customer" || !wa.value.trim())) issues.push({kind,row:n,code:"missing_phone"});
      for (const [field,v] of [["phone",main],["whatsapp",wa]] as const) {
        if (v.type === "number") issues.push({kind,row:n,code:"numeric_phone",field});
        if (v.value.trim() && (v.value.match(/\d/g) ?? []).length < 5) issues.push({kind,row:n,code:"short_phone_review",field});
        if ((v.value.match(/\d{5,}/g) ?? []).length >= 2) issues.push({kind,row:n,code:"multiple_phone_candidates",field});
      }
      rows.push(item);
    }
  }
  const names = new Map<string,SourceRow[]>();
  for (const row of rows) { const k=normalize(row.name); if(k) names.set(k,[...(names.get(k) ?? []),row]); }
  for (const group of names.values()) {
    if (group.filter(r=>r.kind === "lead").length > 1) for (const r of group.filter(r=>r.kind === "lead")) issues.push({kind:r.kind,row:r.row,code:"repeated_lead_name"});
    if (group.some(r=>r.kind === "customer") && group.some(r=>r.kind === "lead")) for (const r of group.filter(r=>r.kind === "lead")) issues.push({kind:r.kind,row:r.row,code:"customer_name_match"});
  }
  const hashes = {customer:digest(customerBytes),lead:digest(leadBytes)};
  const sourceHash = digest(Buffer.from(`emerald-pilot-v1\n${hashes.customer}\n${hashes.lead}\n`));
  return {rows,issues,hashes,sourceHash};
}

/** Only after the owner has reviewed the exact source hashes, issues and mapping. */
export function bindPilotOwners(prepared: Awaited<ReturnType<typeof preparePilotWorkbooks>>, approved: {sourceHash:string; owners:Record<string,string>; unassignedRows:number[]}) {
  if (approved.sourceHash !== prepared.sourceHash) throw new Error("The reviewed source files have changed.");
  const owners = new Map(Object.entries(approved.owners).map(([label,id])=>[ownerKey(label),z.string().uuid().parse(id)]));
  if (owners.size !== Object.keys(approved.owners).length) throw new Error("Duplicate normalized salesperson labels in mapping.");
  const permitted = new Set(approved.unassignedRows);
  const actual = prepared.rows.filter(r=>r.kind === "lead" && !r.ownerLabel).map(r=>r.row);
  if (actual.length !== permitted.size || actual.some(n=>!permitted.has(n))) throw new Error("Unassigned lead rows do not match the approved review.");
  const rows = prepared.rows.map(({ownerLabel, ...r}) => {
    const ownerId = ownerLabel ? owners.get(ownerKey(ownerLabel)) : null;
    if (ownerId === undefined || (!ownerLabel && r.kind !== "lead")) throw new Error(`Salesperson mapping missing for ${r.kind} row ${r.row}.`);
    return {...r,ownerId,reviewCodes:prepared.issues.filter(i=>i.kind===r.kind && i.row===r.row).map(reviewIssueKey)};
  });
  return {sourceHash:prepared.sourceHash,rows};
}

export const reviewIssueKey = (i: Issue) => `${i.kind}:${i.row}:${i.code}:${i.field ?? ""}`;
/** Prepared for a separately approved pilot. No public route or command calls this. */
export async function importReviewedWorkbooks(db: Database, actor: Actor, customerBytes: Buffer, leadBytes: Buffer, approval: {
  sourceHash: string; customers: number; leads: number; owners: Record<string,string>;
  unassignedRows: number[]; reviewedIssues: string[]; acceptedBlankCells: string[];
}) {
  const prepared = await preparePilotWorkbooks(customerBytes, leadBytes);
  if (prepared.issues.some(i=>i.code === "missing_name")) throw new Error("A source name must be resolved before import.");
  const blanks = prepared.issues.filter(i=>i.code === "formula_unusable").map(reviewIssueKey).sort(), accepted = [...approval.acceptedBlankCells].sort();
  if (blanks.length !== accepted.length || blanks.some((key,i)=>key!==accepted[i]))
    throw new Error("Unusable formula cells require an explicit decision to leave those fields blank.");
  if (prepared.rows.filter(r=>r.kind === "customer").length !== approval.customers || prepared.rows.filter(r=>r.kind === "lead").length !== approval.leads)
    throw new Error("Reviewed record counts do not match the source files.");
  const actual = prepared.issues.map(reviewIssueKey).sort(), reviewed = [...approval.reviewedIssues].sort();
  if (actual.length !== reviewed.length || actual.some((issue,i)=>issue !== reviewed[i]))
    throw new Error("Every review issue must match the approved batch.");
  return importPilotBatch(db, actor, bindPilotOwners(prepared, approval));
}
