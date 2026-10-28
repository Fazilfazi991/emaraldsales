import { randomUUID } from "node:crypto";
import type { Database, Queryable } from "./database.js";
import {
  hashToken,
  createAccount,
  passwordRequestFingerprint,
  passwordHash,
} from "./auth.js";
import {
  type Actor,
  Fault,
  executive,
  owns,
  nextDuty,
  requirePolicy,
  businessDay,
  type DutyAction,
  type DutyState,
  checkinInput,
  checkoutInput,
  leadInput,
  followupInput,
  management,
  shopUpdateInput,
  shopTransferInput,
  followupCreateInput,
  followupAssignInput,
} from "./domain.js";
import type { Config } from "./config.js";
import { z } from "zod";
type Row = Record<string, any>;
// Avoid copying possible phone or tax identifiers from free-text reasons into audit logs.
function auditReason(reason: string) {
  return reason.replace(/\+?\d(?:[\d ()+./-]*\d)?/g, match => (match.match(/\d/g) ?? []).length >= 7 ? "[number redacted]" : match);
}
export async function audit(
  tx: Queryable,
  actor: Actor,
  action: string,
  type: string,
  id: string,
  details: unknown,
) {
  await tx.query(
    "INSERT INTO audit_events(id,organization_id,actor_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      randomUUID(),
      actor.organizationId,
      actor.id,
      action,
      type,
      id,
      JSON.stringify(details),
    ],
  );
}
async function one(
  tx: Queryable,
  sql: string,
  args: unknown[],
  message = "Record not found.",
) {
  const row = (await tx.query<Row>(sql, args)).rows[0];
  if (!row) throw new Fault(404, "NOT_FOUND", message);
  return row;
}
export class CRM {
  constructor(
    public db: Database,
    private config: Pick<Config, "visitPolicy" | "dutyPolicy">,
  ) {}
  /** Lock the authenticated membership before deduplication. The response commits with the mutation. */
  async mutate(
    actor: Actor,
    key: string | undefined,
    route: string,
    body: unknown,
    work: (tx: Queryable) => Promise<unknown>,
  ) {
    if (!key || !/^[a-zA-Z0-9_-]{16,100}$/.test(key))
      throw new Fault(
        400,
        "IDEMPOTENCY_REQUIRED",
        "Send a unique Idempotency-Key (16–100 letters, numbers, _ or -).",
      );
    const hash = hashToken(JSON.stringify([route, body]));
    try {
      return await this.db.transaction(async (tx) => {
        const current = await one(
          tx,
          `SELECT m.role,u.active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.user_id=$1 AND m.organization_id=$2 FOR UPDATE`,
          [actor.id, actor.organizationId],
        );
        if (!current.active || current.role !== actor.role)
          throw new Fault(
            403,
            "FORBIDDEN",
            "Account permissions have changed. Sign in again.",
          );
        const previous = (
          await tx.query<Row>(
            "SELECT request_hash,response FROM idempotency WHERE actor_id=$1 AND key=$2",
            [actor.id, key],
          )
        ).rows[0];
        if (previous) {
          if (previous.request_hash !== hash)
            throw new Fault(
              409,
              "KEY_REUSED",
              "This request key was already used for a different request.",
            );
          return previous.response;
        }
        const response = await work(tx);
        await tx.query(
          "INSERT INTO idempotency(actor_id,key,request_hash,response) VALUES($1,$2,$3,$4)",
          [actor.id, key, hash, JSON.stringify(response)],
        );
        return response;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new Fault(
          409,
          "CONFLICT",
          "A conflicting record already exists. Refresh before retrying.",
        );
      throw error;
    }
  }
  async listShops(actor: Actor, p: URLSearchParams) {
    const kind = z.enum(["all", "customer", "lead"]).parse(p.get("kind") ?? "all");
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(p.get("page") ?? 0);
    const search = z
      .string()
      .max(200)
      .parse(p.get("q") ?? "");
    // Search terms are literals: %, _ and backslash are escaped for ILIKE.
    const q = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const filters: unknown[] = [
      actor.organizationId,
      q,
      p.get("person") || null,
      p.get("area") || null,
      p.get("status") || null,
      p.get("lead") === "true",
      p.get("when") || null,
      kind,
      actor.role === "executive" ? actor.id : null,
    ];
    if (filters[2]) z.string().uuid().parse(filters[2]);
    const where = `s.organization_id=$1 AND concat_ws(' ',s.name,s.contact,s.phone,s.area,s.location) ILIKE $2
      AND ($3::uuid IS NULL OR s.assigned_executive_id=$3) AND ($4::text IS NULL OR s.area=$4)
      AND ($5::text IS NULL OR s.status=$5) AND (NOT $6::boolean OR s.status<>'Customer')
      AND ($8::text='all' OR ($8='customer' AND s.status='Customer') OR ($8='lead' AND s.status<>'Customer'))
      AND ($9::uuid IS NULL OR s.status='Customer' OR s.assigned_executive_id=$9)
      AND ($7::text IS NULL OR ($7='due' AND EXISTS(SELECT 1 FROM followups f WHERE f.shop_id=s.id AND f.status='pending'))
        OR ($7='visited' AND EXISTS(SELECT 1 FROM visits v WHERE v.shop_id=s.id))
        OR ($7='never' AND NOT EXISTS(SELECT 1 FROM visits v WHERE v.shop_id=s.id)))`;
    const data = (await this.db.query<Row>(`WITH filtered AS (SELECT s.* FROM shops s WHERE ${where}), paged AS (
      SELECT s.*, (SELECT count(*)::int FROM visits v WHERE v.shop_id=s.id) AS visit_count,
      (SELECT max(checked_in_at) FROM visits v WHERE v.shop_id=s.id) AS last_visit,
      (SELECT min(due_date)::text FROM followups f WHERE f.shop_id=s.id AND f.status='pending') AS next_followup
      FROM filtered s ORDER BY lower(s.name),s.id LIMIT 40 OFFSET $10
    ) SELECT (SELECT count(*)::int FROM filtered) AS total, COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY lower(paged.name),paged.id) FROM paged),'[]'::jsonb) AS rows`,[...filters,page*40])).rows[0];
    const rows: Row[]=data.rows, count: number=data.total;
    return { rows, total: count, page, pageSize: 40 };
  }
  convertLead(actor: Actor, key: string | undefined, id: string, body: unknown) {
    management(actor);
    const data = z.object({ version: z.number().int().positive() }).strict().parse(body);
    return this.mutate(actor, key, `lead.convert:${id}`, data, async (tx) => {
      const before = await one(tx, "SELECT id,status,version FROM shops WHERE organization_id=$1 AND id=$2 FOR UPDATE", [actor.organizationId, id]);
      if (before.version !== data.version)
        throw new Fault(409, "STALE_RECORD", "This enquiry changed. Refresh and try again.");
      if (before.status === "Customer")
        throw new Fault(409, "ALREADY_CUSTOMER", "This enquiry is already a customer.");
      const shop = await one(tx, "UPDATE shops SET status='Customer',version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING id,status,version", [actor.organizationId, id]);
      await audit(tx, actor, "lead.convert", "shop", id, { before: { status: before.status, version: before.version }, after: { status: shop.status, version: shop.version } });
      return { shop };
    });
  }
  updateLeadStatus(actor: Actor, key: string | undefined, id: string, body: unknown) {
    if (actor.role === "delivery") throw new Fault(403,"FORBIDDEN","Delivery staff cannot update enquiries.");
    const data = z.object({ version: z.number().int().positive(), status: z.enum(["New Lead", "Contacted", "Interested", "Not Interested"]) }).strict().parse(body);
    return this.mutate(actor, key, `lead.status:${id}`, data, async tx => {
      const before = await one(tx, "SELECT id,status,version,assigned_executive_id FROM shops WHERE organization_id=$1 AND id=$2 FOR UPDATE", [actor.organizationId,id]);
      if (actor.role === "executive" && before.assigned_executive_id !== actor.id) throw new Fault(403,"FORBIDDEN","Only the assigned salesperson can update this enquiry.");
      if (before.status === "Customer") throw new Fault(409,"ALREADY_CUSTOMER","This record is already a customer.");
      if (before.version !== data.version) throw new Fault(409,"STALE_RECORD","This enquiry changed. Refresh and try again.");
      if (before.status === data.status) throw new Fault(422,"NO_CHANGE","Choose a different status.");
      const shop = await one(tx,"UPDATE shops SET status=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING id,status,version",[actor.organizationId,id,data.status]);
      await audit(tx,actor,"lead.status","shop",id,{before:{status:before.status,version:before.version},after:{status:shop.status,version:shop.version}});
      return {shop};
    });
  }
  async profile(actor: Actor, id: string) {
    return this.db.transaction(async tx=>{
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const shop = await one(
      tx,
      `SELECT shops.*,(SELECT jsonb_build_object('shop_id',v.shop_id) FROM visits v JOIN shops a ON a.id=v.shop_id AND a.organization_id=v.organization_id WHERE v.organization_id=$1 AND v.visitor_id=$3 AND v.lifecycle='open' AND (a.status='Customer' OR a.assigned_executive_id=$3) LIMIT 1) AS own_active_visit FROM shops WHERE organization_id=$1 AND id=$2 AND ($3::uuid IS NULL OR status='Customer' OR assigned_executive_id=$3)`,
      [actor.organizationId, id, actor.role === "executive" ? actor.id : null],
    );
    const visits = (
      await tx.query<Row>(
        "SELECT v.*,u.name AS visitor_name FROM visits v JOIN users u ON u.id=v.visitor_id WHERE v.organization_id=$1 AND v.shop_id=$2 ORDER BY v.checked_in_at DESC,v.id",
        [actor.organizationId, id],
      )
    ).rows;
    const followups = (
      await tx.query<Row>(
        "SELECT f.*,f.due_date::text,u.name AS owner_name FROM followups f JOIN users u ON u.id=f.owner_id WHERE f.organization_id=$1 AND f.shop_id=$2 ORDER BY f.created_at DESC,f.id",
        [actor.organizationId, id],
      )
    ).rows;
    return { shop, visits, followups };
    });
  }
  async shopAudit(actor: Actor, id: string, params: URLSearchParams) {
    await one(this.db, "SELECT id FROM shops WHERE organization_id=$1 AND id=$2 AND ($3::uuid IS NULL OR status='Customer' OR assigned_executive_id=$3)", [actor.organizationId, id, actor.role === "executive" ? actor.id : null]);
    const page = z.coerce.number().int().min(0).max(10000).parse(params.get("page") ?? 0);
    const where = `a.organization_id=$1 AND (
      (a.entity_type='shop' AND a.entity_id=$2) OR
      (a.entity_type='visit' AND EXISTS(SELECT 1 FROM visits v WHERE v.organization_id=$1 AND v.shop_id=$2 AND v.id=a.entity_id)) OR
      (a.entity_type='followup' AND EXISTS(SELECT 1 FROM followups f WHERE f.organization_id=$1 AND f.shop_id=$2 AND f.id=a.entity_id)))`;
    const total = (await this.db.query<Row>(`SELECT count(*)::int AS n FROM audit_events a WHERE ${where}`, [actor.organizationId, id])).rows[0].n;
    const rows = (await this.db.query<Row>(`SELECT a.*,u.name AS actor_name FROM audit_events a JOIN users u ON u.id=a.actor_id WHERE ${where} ORDER BY a.happened_at DESC,a.id DESC LIMIT 40 OFFSET $3`, [actor.organizationId, id, page * 40])).rows;
    return { rows, total, page, pageSize: 40 };
  }
  updateShop(actor: Actor, key: string | undefined, id: string, body: unknown) {
    management(actor);
    const data = shopUpdateInput.parse(body);
    return this.mutate(actor, key, `shop.update:${id}`, data, async (tx) => {
      const before = await one(tx, "SELECT * FROM shops WHERE organization_id=$1 AND id=$2 FOR UPDATE", [actor.organizationId, id]);
      if (before.version !== data.version)
        throw new Fault(409, "STALE_RECORD", "Shop details changed. Refresh before editing.");
      const shop = await one(tx, `UPDATE shops SET name=$3,contact=$4,phone=$5,area=$6,location=$7,notes=$8,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *`, [actor.organizationId, id, data.name, data.contact, data.phone, data.area, data.location, data.notes]);
      const changedFields = ["name", "contact", "phone", "area", "location", "notes"].filter(field => before[field] !== shop[field]);
      await audit(tx, actor, "shop.update", "shop", id, { changedFields, beforeVersion: before.version, afterVersion: shop.version, reason: auditReason(data.reason) });
      return { shop };
    });
  }
  private async activeExecutive(tx: Queryable, actor: Actor, id: string) {
    const target = (await tx.query<Row>(`SELECT m.user_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.role='executive' AND u.active FOR SHARE`, [actor.organizationId, id])).rows[0];
    if (!target)
      throw new Fault(422, "INVALID_EXECUTIVE", "Choose an active executive from this team.");
  }
  transferShop(actor: Actor, key: string | undefined, id: string, body: unknown) {
    management(actor);
    const data = shopTransferInput.parse(body);
    return this.mutate(actor, key, `shop.transfer:${id}`, data, async (tx) => {
      await this.activeExecutive(tx, actor, data.assignedExecutiveId);
      const before = await one(tx, "SELECT * FROM shops WHERE organization_id=$1 AND id=$2 FOR UPDATE", [actor.organizationId, id]);
      if (before.version !== data.version)
        throw new Fault(409, "STALE_RECORD", "Shop assignment changed. Refresh before editing.");
      if (before.assigned_executive_id === data.assignedExecutiveId)
        throw new Fault(422, "NO_CHANGE", "This executive already owns the shop.");
      if(before.status!=="Customer") {
        const work=await one(tx,`SELECT EXISTS(SELECT 1 FROM visits WHERE organization_id=$1 AND shop_id=$2 AND lifecycle='open') OR EXISTS(SELECT 1 FROM followups WHERE organization_id=$1 AND shop_id=$2 AND status='pending') AS blocked`,[actor.organizationId,id]);
        if(work.blocked) throw new Fault(409,"LEAD_HAS_WORK","Complete the open visit and pending follow-ups before transferring this enquiry.");
      }
      const shop = await one(tx, `UPDATE shops SET assigned_executive_id=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *`, [actor.organizationId, id, data.assignedExecutiveId]);
      await audit(tx, actor, "shop.transfer", "shop", id, {
        before: { assignedExecutiveId: before.assigned_executive_id, version: before.version },
        after: { assignedExecutiveId: shop.assigned_executive_id, version: shop.version },
        reason: auditReason(data.reason),
      });
      return { shop };
    });
  }
  createFollowup(actor: Actor, key: string | undefined, body: unknown) {
    executive(actor);
    requirePolicy(this.config.visitPolicy, "Follow-up changes", "approved-v2");
    const data = followupCreateInput.parse(body);
    return this.mutate(actor, key, "followup.create", data, async (tx) => {
      const visit = await one(tx, "SELECT * FROM visits WHERE organization_id=$1 AND id=$2 FOR UPDATE", [actor.organizationId, data.visitId]);
      owns(actor, visit.visitor_id);
      if (visit.lifecycle !== "completed")
        throw new Fault(409, "VISIT_OPEN", "Finish this visit before adding a follow-up.");
      const shop=await one(tx,"SELECT status,assigned_executive_id FROM shops WHERE organization_id=$1 AND id=$2 FOR UPDATE",[actor.organizationId,visit.shop_id]);
      if(shop.status!=="Customer" && shop.assigned_executive_id!==actor.id) throw new Fault(403,"FORBIDDEN","Only the assigned salesperson can add an enquiry follow-up.");
      await this.futureDate(tx, data.dueDate);
      const followup = await one(tx, `INSERT INTO followups(id,organization_id,shop_id,visit_id,owner_id,created_by,due_date) VALUES($1,$2,$3,$4,$5,$5,$6) RETURNING *,due_date::text`, [randomUUID(), actor.organizationId, visit.shop_id, visit.id, actor.id, data.dueDate]);
      await audit(tx, actor, "followup.create", "followup", followup.id, { visitId: visit.id, ownerId: actor.id, dueDate: data.dueDate });
      return { followup };
    });
  }
  private async futureDate(tx: Queryable, date: string) {
    const day = (await tx.query<Row>("SELECT (now() AT TIME ZONE 'Asia/Dubai')::date::text AS day")).rows[0].day;
    if (date < day)
      throw new Fault(422, "PAST_FOLLOWUP", "Choose today or a future UAE date.");
  }
  assignFollowup(actor: Actor, key: string | undefined, id: string, body: unknown) {
    management(actor);
    requirePolicy(this.config.visitPolicy, "Follow-up changes", "approved-v2");
    const data = followupAssignInput.parse(body);
    return this.mutate(actor, key, `followup.assign:${id}`, data, async (tx) => {
      await this.activeExecutive(tx, actor, data.ownerId);
      const before = await one(tx, "SELECT *,due_date::text FROM followups WHERE organization_id=$1 AND id=$2 FOR UPDATE", [actor.organizationId, id]);
      if (before.version !== data.version || before.status !== "pending")
        throw new Fault(409, "STALE_RECORD", "This follow-up changed. Refresh before editing.");
      if (before.owner_id === data.ownerId)
        throw new Fault(422, "NO_CHANGE", "This executive already owns the follow-up.");
      const shop=await one(tx,"SELECT status,assigned_executive_id FROM shops WHERE organization_id=$1 AND id=$2 FOR UPDATE",[actor.organizationId,before.shop_id]);
      if(shop.status!=="Customer" && shop.assigned_executive_id!==data.ownerId) throw new Fault(409,"LEAD_ASSIGNMENT_REQUIRED","Assign the enquiry to this salesperson before assigning its follow-up.");
      const followup = await one(tx, `UPDATE followups SET owner_id=$3,updated_at=now(),version=version+1 WHERE organization_id=$1 AND id=$2 RETURNING *,due_date::text`, [actor.organizationId, id, data.ownerId]);
      await audit(tx, actor, "followup.assign", "followup", id, { before, after: followup, reason: auditReason(data.reason) });
      return { followup };
    });
  }
  async visits(actor: Actor, p: URLSearchParams, db: Queryable = this.db) {
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(p.get("page") ?? 0);
    const args = [
      actor.organizationId,
      p.get("q") ?? "",
      p.get("person") || null,
      p.get("from") || null,
      p.get("to") || null,
      p.get("area") || null,
      p.get("status") || null,
      actor.role === "executive" ? actor.id : null,
    ];
    z.string().max(200).parse(args[1]);
    if (args[2]) z.string().uuid().parse(args[2]);
    for (const day of [args[3], args[4]])
      if (day) {
        const { calendarDate } = await import("./domain.js");
        calendarDate.parse(day);
      }
    if (args[3] && args[4] && args[3] > args[4])
      throw new Fault(
        400,
        "INVALID_RANGE",
        "Start date must be before end date.",
      );
    const where = `v.organization_id=$1 AND position(lower($2) IN lower(s.name||' '||u.name||' '||v.notes))>0
      AND ($3::uuid IS NULL OR v.visitor_id=$3) AND ($4::date IS NULL OR v.checked_in_at >= ($4::date::timestamp AT TIME ZONE 'Asia/Dubai'))
      AND ($5::date IS NULL OR v.checked_in_at < (($5::date+1)::timestamp AT TIME ZONE 'Asia/Dubai'))
      AND ($6::text IS NULL OR s.area=$6) AND ($7::text IS NULL OR v.outcome=$7 OR ($7='Currently Visiting' AND v.lifecycle='open'))
      AND ($8::uuid IS NULL OR s.status='Customer' OR s.assigned_executive_id=$8)`;
    const join =
      "FROM visits v JOIN shops s ON s.id=v.shop_id JOIN users u ON u.id=v.visitor_id";
    const total = (
      await db.query<Row>(
        `SELECT count(*)::int AS n ${join} WHERE ${where}`,
        args,
      )
    ).rows[0].n;
    const rows = (
      await db.query<Row>(
        `SELECT v.*,s.name AS shop_name,s.area,u.name AS visitor_name ${join} WHERE ${where} ORDER BY v.checked_in_at DESC,v.id LIMIT 40 OFFSET $9`,
        [...args, page * 40],
      )
    ).rows;
    return { rows, total, page, pageSize: 40 };
  }
  async dashboard(actor: Actor) {
    return this.db.transaction(async tx=>{
      await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      return this.dashboardReads(actor,tx);
    });
  }
  private async dashboardReads(actor: Actor, db: Queryable) {
    const person = actor.role === "executive" ? actor.id : null;
    // All counters come from authoritative rows; no duplicated last-visit or visit-id lists.
    const metrics = (
      await db.query<Row>(
        `SELECT
      (SELECT count(*)::int FROM memberships WHERE organization_id=$1 AND role='executive') AS executives,
      (SELECT count(*)::int FROM shops WHERE organization_id=$1 AND status='Customer') AS customers,
      (SELECT count(*)::int FROM shops WHERE organization_id=$1 AND status<>'Customer' AND ($2::uuid IS NULL OR assigned_executive_id=$2)) AS enquiries,
      (SELECT count(*)::int FROM visits WHERE organization_id=$1 AND ($2::uuid IS NULL OR visitor_id=$2) AND checked_in_at >= (date_trunc('day',now() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai') AND checked_in_at < ((date_trunc('day',now() AT TIME ZONE 'Asia/Dubai')+interval '1 day') AT TIME ZONE 'Asia/Dubai')) AS today,
      (SELECT count(*)::int FROM visits WHERE organization_id=$1 AND ($2::uuid IS NULL OR visitor_id=$2) AND lifecycle='completed' AND (checked_in_at AT TIME ZONE 'Asia/Dubai')::date=(now() AT TIME ZONE 'Asia/Dubai')::date) AS completed,
      (SELECT count(*)::int FROM shops WHERE organization_id=$1 AND ($2::uuid IS NULL OR created_by=$2) AND (created_at AT TIME ZONE 'Asia/Dubai')::date=(now() AT TIME ZONE 'Asia/Dubai')::date) AS new_shops,
      (SELECT count(*)::int FROM followups WHERE organization_id=$1 AND ($2::uuid IS NULL OR owner_id=$2) AND status='pending') AS pending,
      (now() AT TIME ZONE 'Asia/Dubai')::date::text AS day,now() AS server_time`,
        [actor.organizationId, person],
      )
    ).rows[0];
    const active = (
      await db.query<Row>(
        `SELECT v.*,s.name AS shop_name,s.area,u.name AS visitor_name FROM visits v JOIN shops s ON s.id=v.shop_id JOIN users u ON u.id=v.visitor_id WHERE v.organization_id=$1 AND ($2::uuid IS NULL OR (v.visitor_id=$2 AND (s.status='Customer' OR s.assigned_executive_id=$2))) AND v.lifecycle='open' ORDER BY v.checked_in_at`,
        [actor.organizationId, person],
      )
    ).rows;
    const followups = (
      await db.query<Row>(
        `SELECT f.*,f.due_date::text,s.name AS shop_name,u.name AS owner_name FROM followups f JOIN shops s ON s.id=f.shop_id JOIN users u ON u.id=f.owner_id WHERE f.organization_id=$1 AND ($2::uuid IS NULL OR (f.owner_id=$2 AND (s.status='Customer' OR s.assigned_executive_id=$2))) AND f.status='pending' AND f.due_date <= (now() AT TIME ZONE 'Asia/Dubai')::date+3 ORDER BY f.due_date,f.id LIMIT 100`,
        [actor.organizationId, person],
      )
    ).rows;
    const today = await this.visits(
      actor,
      new URLSearchParams({ from: metrics.day, to: metrics.day, ...(person ? { person } : {}) }), db,
    );
    const team = (
      await db.query<Row>(
        `SELECT u.id,u.name,
      (SELECT count(*)::int FROM visits v WHERE v.organization_id=m.organization_id AND v.visitor_id=u.id AND (v.checked_in_at AT TIME ZONE 'Asia/Dubai')::date=(now() AT TIME ZONE 'Asia/Dubai')::date AND v.lifecycle='completed') AS completed,
      (SELECT count(*)::int FROM visits v WHERE v.organization_id=m.organization_id AND v.visitor_id=u.id AND v.lifecycle='open') AS active,
      (SELECT count(*)::int FROM visits v WHERE v.organization_id=m.organization_id AND v.visitor_id=u.id AND (v.checked_in_at AT TIME ZONE 'Asia/Dubai')::date BETWEEN (now() AT TIME ZONE 'Asia/Dubai')::date-6 AND (now() AT TIME ZONE 'Asia/Dubai')::date) AS week,
      (SELECT count(*)::int FROM shops s WHERE s.organization_id=m.organization_id AND s.assigned_executive_id=u.id AND s.status<>'Customer') AS leads,
      (SELECT count(*)::int FROM followups f WHERE f.organization_id=m.organization_id AND f.owner_id=u.id AND f.status='pending') AS pending
      FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.role='executive' ORDER BY u.name`,
        [actor.organizationId],
      )
    ).rows;
    const recent = (
      await db.query<Row>(
        `SELECT * FROM shops WHERE organization_id=$1 AND ($2::uuid IS NULL OR status='Customer' OR assigned_executive_id=$2) AND created_at>=now()-interval '7 days' ORDER BY created_at DESC LIMIT 4`,
        [actor.organizationId, person],
      )
    ).rows;
    return { metrics, active, followups, today, team, recent };
  }
  private async openVisit(
    tx: Queryable,
    actor: Actor,
    shopId: string,
    location: unknown,
  ) {
    executive(actor);
    requirePolicy(this.config.visitPolicy, "Visit recording", "approved-v2");
    await one(
      tx,
      "SELECT id FROM shops WHERE organization_id=$1 AND id=$2 AND (status='Customer' OR assigned_executive_id=$3) FOR UPDATE",
      [actor.organizationId, shopId, actor.id],
    );
    const conflict = (
      await tx.query<Row>(
        `SELECT id FROM visits WHERE organization_id=$1 AND lifecycle='open' AND visitor_id=$2`,
        [actor.organizationId, actor.id],
      )
    ).rows[0];
    if (conflict)
      throw new Fault(
        409,
        "OPEN_VISIT",
        "Finish your current visit before starting another.",
      );
    const id = randomUUID();
    const visit = await one(
      tx,
      `INSERT INTO visits(id,organization_id,shop_id,visitor_id,created_by,location) VALUES($1,$2,$3,$4,$4,$5) RETURNING *`,
      [id, actor.organizationId, shopId, actor.id, JSON.stringify(location)],
    );
    await audit(tx, actor, "visit.checkin", "visit", id, { shopId, location });
    return visit;
  }
  checkin(actor: Actor, key: string | undefined, body: unknown) {
    executive(actor);
    const data = checkinInput.parse(body);
    return this.mutate(actor, key, "checkin", data, async (tx) => ({
      visit: await this.openVisit(tx, actor, data.shopId, data.location),
    }));
  }
  checkout(actor: Actor, key: string | undefined, id: string, body: unknown) {
    executive(actor);
    requirePolicy(this.config.visitPolicy, "Visit recording", "approved-v2");
    const data = checkoutInput.parse(body);
    return this.mutate(actor, key, `checkout:${id}`, data, async (tx) => {
      const v = await one(
        tx,
        "SELECT * FROM visits WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [actor.organizationId, id],
      );
      owns(actor, v.visitor_id);
      if (v.lifecycle !== "open")
        throw new Fault(
          409,
          "VISIT_COMPLETED",
          "This visit is already completed. Corrections require a separately permitted audit workflow.",
        );
      const day = (
        await tx.query<Row>(
          "SELECT (now() AT TIME ZONE 'Asia/Dubai')::date::text AS day",
        )
      ).rows[0].day;
      if (data.followUpDate && data.followUpDate < day)
        throw new Fault(
          422,
          "PAST_FOLLOWUP",
          "Choose today or a future UAE date.",
        );
      const visit = await one(
        tx,
        `UPDATE visits SET lifecycle='completed',checked_out_at=now(),outcome=$3,notes=$4,order_status=$5,order_note=$6,order_value=$7,version=version+1 WHERE organization_id=$1 AND id=$2 AND lifecycle='open' RETURNING *`,
        [
          actor.organizationId,
          id,
          data.outcome,
          data.notes,
          data.orderStatus,
          data.orderNote,
          data.orderValue,
        ],
      );
      let followup = null;
      if (data.followUpDate) {
        followup = await one(
          tx,
          `INSERT INTO followups(id,organization_id,shop_id,visit_id,owner_id,created_by,due_date) VALUES($1,$2,$3,$4,$5,$5,$6) RETURNING *,due_date::text`,
          [
            randomUUID(),
            actor.organizationId,
            v.shop_id,
            id,
            actor.id,
            data.followUpDate,
          ],
        );
        await audit(tx, actor, "followup.create", "followup", followup.id, {
          dueDate: data.followUpDate,
          visitId: id,
        });
      }
      // Assignment and canonical shop status never change as a side effect of checkout.
      const { notes: _notes, orderNote: _orderNote, ...checkoutAudit } = data;
      await audit(tx, actor, "visit.checkout", "visit", id, {
        ...checkoutAudit,
        previousVersion: v.version,
      });
      return { visit, followup };
    });
  }
  lead(actor: Actor, key: string | undefined, body: unknown) {
    executive(actor);
    const data = leadInput.parse(body);
    if (actor.role === "executive" && data.assignedExecutiveId !== actor.id)
      throw new Fault(
        403,
        "FORBIDDEN",
        "Executives may assign new discoveries only to themselves.",
      );
    if (data.checkIn) {
      executive(actor);
      requirePolicy(this.config.visitPolicy, "Visit recording", "approved-v2");
    }
    return this.mutate(actor, key, "lead", data, async (tx) => {
      await one(
        tx,
        `SELECT user_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.role='executive' AND u.active`,
        [actor.organizationId, data.assignedExecutiveId],
        "Choose an active executive.",
      );
      const id = randomUUID();
      const shop = await one(
        tx,
        `INSERT INTO shops(id,organization_id,name,contact,phone,area,location,notes,status,assigned_executive_id,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'New Lead',$9,$10) RETURNING *`,
        [
          id,
          actor.organizationId,
          data.name,
          data.contact,
          data.phone,
          data.area,
          data.location,
          data.notes,
          data.assignedExecutiveId,
          actor.id,
        ],
      );
      await audit(tx, actor, "shop.discover", "shop", id, {
        assignedExecutiveId: data.assignedExecutiveId,
      });
      const visit = data.checkIn
        ? await this.openVisit(tx, actor, id, data.gps)
        : null;
      return { shop, visit };
    });
  }
  updateFollowup(
    actor: Actor,
    key: string | undefined,
    id: string,
    body: unknown,
  ) {
    executive(actor);
    requirePolicy(this.config.visitPolicy, "Follow-up changes", "approved-v2");
    const data = followupInput.parse(body);
    return this.mutate(actor, key, `followup:${id}`, data, async (tx) => {
      const old = await one(
        tx,
        "SELECT *,due_date::text FROM followups WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [actor.organizationId, id],
      );
      owns(actor, old.owner_id);
      if (old.status !== "pending" || old.version !== data.version)
        throw new Fault(
          409,
          "STALE_RECORD",
          "This follow-up changed. Refresh before editing.",
        );
      if (data.action === "reschedule") {
        const day = (
          await tx.query<Row>(
            "SELECT (now() AT TIME ZONE 'Asia/Dubai')::date::text AS day",
          )
        ).rows[0].day;
        if (data.dueDate < day)
          throw new Fault(
            422,
            "PAST_FOLLOWUP",
            "Choose today or a future UAE date.",
          );
      }
      const updated = await one(
        tx,
        `UPDATE followups SET status=$3,due_date=$4,updated_at=now(),version=version+1 WHERE organization_id=$1 AND id=$2 RETURNING *,due_date::text`,
        [
          actor.organizationId,
          id,
          data.action === "complete"
            ? "completed"
            : data.action === "cancel"
              ? "cancelled"
              : "pending",
          data.action === "reschedule" ? data.dueDate : old.due_date,
        ],
      );
      await audit(tx, actor, `followup.${data.action}`, "followup", id, {
        before: old,
        after: updated,
        reason: auditReason(data.reason),
      });
      return { followup: updated };
    });
  }
  async dutyHistory(actor: Actor, person?: string) {
    const owner = person || (actor.role === "executive" || actor.role === "delivery" ? actor.id : null);
    if ((actor.role === "executive" || actor.role === "delivery") && owner !== actor.id)
      throw new Fault(
        403,
        "FORBIDDEN",
        "Duty history is private to you and management.",
      );
    if (owner) z.string().uuid().parse(owner);
    const data=(await this.db.query<Row>(`WITH sessions AS (
      SELECT d.*,u.name FROM duty_sessions d JOIN users u ON u.id=d.executive_id WHERE d.organization_id=$1 AND ($2::uuid IS NULL OR d.executive_id=$2) ORDER BY d.started_at DESC LIMIT 100
    ) SELECT COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.started_at DESC) FROM sessions s),'[]'::jsonb) AS sessions,
      COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.started_at) FROM rest_intervals r WHERE r.organization_id=$1 AND r.session_id IN (SELECT id FROM sessions)),'[]'::jsonb) AS rests`,[actor.organizationId,owner])).rows[0];
    const {sessions,rests}=data;
    return { sessions, rests };
  }
  duty(
    actor: Actor,
    key: string | undefined,
    action: DutyAction,
    body: unknown,
  ) {
    if (actor.role !== "executive" && actor.role !== "delivery") throw new Fault(403,"FORBIDDEN","Only staff can record their own duty.");
    requirePolicy(this.config.dutyPolicy, "Duty recording");
    const data = z
      .object({ expectedSessionId: z.string().uuid().nullable() })
      .strict()
      .parse(body);
    return this.mutate(actor, key, `duty:${action}`, data, async (tx) => {
      const session = (
        await tx.query<Row>(
          "SELECT * FROM duty_sessions WHERE organization_id=$1 AND executive_id=$2 AND ended_at IS NULL FOR UPDATE",
          [actor.organizationId, actor.id],
        )
      ).rows[0];
      const rest = session
        ? (
            await tx.query<Row>(
              "SELECT * FROM rest_intervals WHERE session_id=$1 AND ended_at IS NULL FOR UPDATE",
              [session.id],
            )
          ).rows[0]
        : null;
      if ((session?.id ?? null) !== data.expectedSessionId)
        throw new Fault(
          409,
          "STALE_RECORD",
          "Duty state changed. Refresh before retrying.",
        );
      const current: DutyState = !session ? "off" : rest ? "rest" : "on";
      const next = nextDuty(current, action);
      let id = session?.id;
      if (action === "start") {
        id = randomUUID();
        await tx.query(
          "INSERT INTO duty_sessions(id,organization_id,executive_id) VALUES($1,$2,$3)",
          [id, actor.organizationId, actor.id],
        );
      }
      if (action === "rest")
        await tx.query(
          "INSERT INTO rest_intervals(id,organization_id,session_id) VALUES($1,$2,$3)",
          [randomUUID(), actor.organizationId, id],
        );
      if (action === "return")
        await tx.query("UPDATE rest_intervals SET ended_at=now() WHERE id=$1", [
          rest!.id,
        ]);
      if (action === "end")
        await tx.query("UPDATE duty_sessions SET ended_at=now() WHERE id=$1", [
          id,
        ]);
      await audit(tx, actor, `duty.${action}`, "duty_session", id, {
        from: current,
        to: next,
      });
      return { state: next, sessionId: id };
    });
  }
  async accounts(actor: Actor) {
    if (actor.role !== "admin" && actor.role !== "manager")
      throw new Fault(403, "FORBIDDEN", "Only managers and admins manage accounts.");
    return (
      await this.db.query(
        "SELECT u.id,u.email,u.name,u.active,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=$1 ORDER BY u.name",
        [actor.organizationId],
      )
    ).rows;
  }
  setAccountActive(actor: Actor, key: string | undefined, id: string, body: unknown) {
    if (actor.role !== "admin" && actor.role !== "manager") throw new Fault(403,"FORBIDDEN","Only managers and admins manage accounts.");
    const data=z.object({active:z.boolean()}).strict().parse(body);
    if(id===actor.id && !data.active) throw new Fault(422,"INVALID_ACCOUNT","You cannot disable your own account.");
    return this.mutate(actor,key,`account.active:${id}`,data,async tx=>{
      const target=await one(tx,"SELECT u.id,u.active,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=$1 AND u.id=$2 FOR UPDATE",[actor.organizationId,id]);
      if(actor.role==="manager" && !["executive","delivery"].includes(target.role)) throw new Fault(403,"FORBIDDEN","Only admins manage manager and admin accounts.");
      if(target.active===data.active) throw new Fault(422,"NO_CHANGE","Account already has this status.");
      await tx.query("UPDATE users SET active=$2 WHERE id=$1",[id,data.active]);
      if(!data.active) await tx.query("DELETE FROM sessions WHERE user_id=$1",[id]);
      await audit(tx,actor,"account.status","user",id,{active:data.active});
      return {id,active:data.active};
    });
  }
  async resetAccountPassword(actor: Actor, key: string | undefined, id: string, body: unknown) {
    if (actor.role !== "admin" && actor.role !== "manager") throw new Fault(403,"FORBIDDEN","Only managers and admins manage accounts.");
    const data=z.object({password:z.string().min(14).max(128)}).strict().parse(body);
    if (!key || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new Fault(400,"IDEMPOTENCY_REQUIRED","Send a unique request key.");
    const fingerprint=await passwordRequestFingerprint(data.password,key);
    return this.mutate(actor,key,`account.reset:${id}`,{fingerprint},async tx=>{
      const target=await one(tx,"SELECT u.id,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=$1 AND u.id=$2 FOR UPDATE",[actor.organizationId,id]);
      if(actor.role==="manager" && !["executive","delivery"].includes(target.role)) throw new Fault(403,"FORBIDDEN","Only admins manage manager and admin accounts.");
      await tx.query("UPDATE users SET password_hash=$2 WHERE id=$1",[id,await passwordHash(data.password)]);
      await tx.query("DELETE FROM sessions WHERE user_id=$1",[id]);
      await audit(tx,actor,"account.password_reset","user",id,{});
      return {id,reset:true};
    });
  }
  setAccountRole(actor: Actor, key: string | undefined, id: string, body: unknown) {
    if(actor.role!=="admin" && actor.role!=="manager") throw new Fault(403,"FORBIDDEN","Only managers and admins manage accounts.");
    const data=z.object({role:z.enum(["executive","manager","admin","delivery"])}).strict().parse(body);
    if(id===actor.id) throw new Fault(422,"INVALID_ACCOUNT","You cannot change your own role.");
    return this.mutate(actor,key,`account.role:${id}`,data,async tx=>{
      const target=await one(tx,"SELECT m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=$1 AND u.id=$2 FOR UPDATE",[actor.organizationId,id]);
      if(actor.role==="manager" && (!["executive","delivery"].includes(target.role) || !["executive","delivery"].includes(data.role))) throw new Fault(403,"FORBIDDEN","Only admins manage manager and admin roles.");
      if(target.role===data.role) throw new Fault(422,"NO_CHANGE","Account already has this role.");
      const pending=await one(tx,`SELECT
        EXISTS(SELECT 1 FROM duty_sessions WHERE organization_id=$1 AND executive_id=$2 AND ended_at IS NULL)
        OR EXISTS(SELECT 1 FROM visits WHERE organization_id=$1 AND visitor_id=$2 AND lifecycle='open')
        OR ($3='executive' AND (
          EXISTS(SELECT 1 FROM shops WHERE organization_id=$1 AND assigned_executive_id=$2)
          OR EXISTS(SELECT 1 FROM followups WHERE organization_id=$1 AND owner_id=$2 AND status='pending')
        )) AS blocked`,[actor.organizationId,id,target.role]);
      if(pending.blocked) throw new Fault(409,"ACCOUNT_HAS_WORK","Complete active duty and visits, and transfer assigned customers and pending follow-ups before changing this role.");
      await tx.query("UPDATE memberships SET role=$3 WHERE organization_id=$1 AND user_id=$2",[actor.organizationId,id,data.role]);
      await tx.query("DELETE FROM sessions WHERE user_id=$1",[id]);
      await audit(tx,actor,"account.role","user",id,{from:target.role,to:data.role});
      return {id,role:data.role};
    });
  }
  async addAccount(actor: Actor, key: string | undefined, body: unknown) {
    if (actor.role !== "admin" && actor.role !== "manager")
      throw new Fault(403, "FORBIDDEN", "Only managers and admins manage accounts.");
    const data = z
      .object({
        email: z.string().email().max(254),
        name: z.string().trim().min(1).max(120),
        role: z.enum(["executive", "manager", "admin", "delivery"]),
        password: z.string().min(14).max(128),
      })
      .strict()
      .parse(body);
    if(actor.role==="manager" && !["executive","delivery"].includes(data.role)) throw new Fault(403,"FORBIDDEN","Only admins create manager and admin accounts.");
    if (!key || !/^[a-zA-Z0-9_-]{16,100}$/.test(key))
      throw new Fault(
        400,
        "IDEMPOTENCY_REQUIRED",
        "Send a unique Idempotency-Key.",
      );
    // Never persist a password in an idempotency request/response or audit detail.
    return this.mutate(
      actor,
      key,
      "account.create",
      {
        ...data,
        password: await passwordRequestFingerprint(data.password, key),
      },
      async (tx) => {
        const id = await createAccount(
          tx,
          actor.organizationId,
          data.email,
          data.name,
          data.role,
          data.password,
        );
        await audit(tx, actor, "account.create", "user", id, {
          email: data.email,
          role: data.role,
        });
        return { id };
      },
    );
  }
}
