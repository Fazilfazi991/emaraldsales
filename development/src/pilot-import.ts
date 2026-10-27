/** Private pilot import primitive. Deliberately not exposed as an HTTP route or CLI. */
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database } from "./database.js";
import { Fault, management, type Actor } from "./domain.js";
import { audit } from "./service.js";

const cellType = z.enum(["empty", "text", "number"]);
const rowSchema = z.object({
  kind: z.enum(["customer", "lead"]), row: z.number().int().min(2),
  name: z.string().trim().min(1).max(160), contact: z.string().max(120),
  phone: z.string().max(1000), phoneType: cellType,
  phoneFormat: z.string().max(1000).default(""),
  whatsapp: z.string().max(1000), whatsappType: cellType,
  whatsappFormat: z.string().max(1000).default(""),
  reviewCodes: z.array(z.string().max(100)).max(100).default([]),
  area: z.string().max(100), emirate: z.string().max(100), country: z.string().max(100),
  zohoId: z.string().max(300), ownerId: z.string().uuid().nullable(),
}).strict();
const batchSchema = z.object({ sourceHash: z.string().regex(/^[a-f0-9]{64}$/), rows: z.array(rowSchema).min(1).max(10000) }).strict();
/** Validation results contain paths and reasons only, never source values. */
export function validatePilotBatch(input: unknown) {
  const result=batchSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map(issue=>({path:issue.path.join("."),message:issue.message}));
}

/** Caller must verify source hashes and approve the complete mapping before invoking. */
export async function importPilotBatch(db: Database, actor: Actor, input: unknown) {
  management(actor);
  const batch = batchSchema.parse(input);
  const keys = batch.rows.map((r) => `${r.kind}:${r.row}`);
  if (new Set(keys).size !== keys.length) throw new Fault(422, "DUPLICATE_SOURCE_ROW", "A source row appears more than once.");
  const manifestHash = createHash("sha256").update(JSON.stringify(batch.rows)).digest("hex");
  return db.transaction(async (tx) => {
    const membership = (await tx.query<{role: string; active: boolean}>("SELECT m.role,u.active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.user_id=$2 FOR UPDATE", [actor.organizationId, actor.id])).rows[0];
    if (!membership || !membership.active || membership.role !== actor.role) throw new Fault(403, "FORBIDDEN", "Account permissions have changed.");
    // Serializes imports for this organization, including different managers and source hashes.
    await tx.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [actor.organizationId]);
    const previous = (await tx.query<{id: string; status: string; manifest_hash: string}>("SELECT id,status,manifest_hash FROM import_batches WHERE organization_id=$1 AND source_hash=$2", [actor.organizationId, batch.sourceHash])).rows[0];
    if (previous) {
      if (previous.status !== "committed" || previous.manifest_hash !== manifestHash) throw new Fault(409, "IMPORT_MISMATCH", "The source batch was already recorded with different details.");
      const counts = (await tx.query<{kind: string; n: number}>("SELECT source_kind AS kind,count(*)::int AS n FROM import_source_rows WHERE batch_id=$1 GROUP BY source_kind", [previous.id])).rows;
      return { batchId: previous.id, replay: true, customers: counts.find((r) => r.kind === "customer")?.n ?? 0, leads: counts.find((r) => r.kind === "lead")?.n ?? 0 };
    }
    const existing = (await tx.query<{n: number}>("SELECT count(*)::int AS n FROM shops WHERE organization_id=$1", [actor.organizationId])).rows[0].n;
    if (existing) throw new Fault(409, "WORKSPACE_NOT_EMPTY", "The initial pilot import requires a separate empty workspace.");
    for (const ownerId of new Set(batch.rows.map((r) => r.ownerId).filter((id): id is string => id !== null))) {
      const owner = (await tx.query("SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.role='executive' AND u.active", [actor.organizationId, ownerId])).rows[0];
      if (!owner) throw new Fault(422, "INVALID_OWNER", "An assigned salesperson is not an active executive in this workspace.");
    }
    const batchId = randomUUID();
    await tx.query("INSERT INTO import_batches(id,organization_id,source_name,source_hash,status,created_by,manifest_hash) VALUES($1,$2,'pilot-approved-batch',$3,'staged',$4,$5)", [batchId, actor.organizationId, batch.sourceHash, actor.id, manifestHash]);
    for (const r of batch.rows) {
      const id = randomUUID();
      await tx.query("INSERT INTO shops(id,organization_id,name,contact,phone,area,location,notes,status,assigned_executive_id,created_by,synthetic,import_batch_id,emirate,country,whatsapp,zoho_contact_id) VALUES($1,$2,$3,$4,$5,$6,'','',$7,$8,$9,false,$10,$11,$12,$13,$14)", [id,actor.organizationId,r.name,r.contact,r.phone,r.area,r.kind === 'customer' ? 'Customer' : 'New Lead',r.ownerId,actor.id,batchId,r.emirate,r.country,r.whatsapp,r.zohoId]);
      await tx.query("INSERT INTO import_source_rows(organization_id,batch_id,source_kind,source_row,shop_id,phone_cell_type,whatsapp_cell_type,phone_format,whatsapp_format,review_codes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [actor.organizationId,batchId,r.kind,r.row,id,r.phoneType,r.whatsappType,r.phoneFormat,r.whatsappFormat,JSON.stringify(r.reviewCodes)]);
    }
    await tx.query("UPDATE import_batches SET status='committed' WHERE id=$1", [batchId]);
    const customers = batch.rows.filter((r) => r.kind === "customer").length, leads = batch.rows.length - customers;
    await audit(tx, actor, "pilot.import", "import_batch", batchId, { customers, leads });
    return { batchId, replay: false, customers, leads };
  });
}
