import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { type Database } from "./database.js";
import { createAccount } from "./auth.js";
import { businessDay, type Role } from "./domain.js";
export function syntheticId(label: string) {
  const hex = createHash("sha256")
    .update(`emerald-synthetic:${label}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export async function seedSynthetic(db: Database, volume = 700) {
  if (volume < 36 || volume > 5000)
    throw new Error("Synthetic volume must be 36–5000.");
  const source = JSON.parse(
    await readFile(
      new URL("../fixtures/reference-synthetic.json", import.meta.url),
      "utf8",
    ),
  );
  const accounts: {
    id: string;
    email: string;
    name: string;
    role: Role;
    password: string;
  }[] = [];
  const org = syntheticId("organization");
  await db.transaction(async (tx) => {
    const count = (
      await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM users")
    ).rows[0].n;
    if (count)
      throw new Error(
        "Synthetic seed requires an empty database; no existing records were changed.",
      );
    await tx.query("INSERT INTO organizations(id,name) VALUES($1,$2)", [
      org,
      "Emerald Interlink · Synthetic review workspace",
    ]);
    for (const [slug, name, role] of [
      ["ahmed", "Ahmed Hassan", "executive"],
      ["shihab", "Shihab K.", "executive"],
      ["naseer", "Naseer M.", "executive"],
      ["manager", "Manager", "manager"],
      ["admin", "Local Administrator", "admin"],
    ] as const) {
      const password = randomBytes(24).toString("base64url"),
        email = `${slug}@local.invalid`;
      const id = await createAccount(tx, org, email, name, role, password);
      accounts.push({ id, email, name, role, password });
    }
    const person = (slug: string) =>
      accounts.find((a) => a.email === `${slug}@local.invalid`)!.id;
    for (let i = 0; i < volume; i++) {
      const s = source.shops[i % 36];
      const name =
        i < 36
          ? s.name
          : `Synthetic Shop ${String(i + 1).padStart(4, "0")} · ${s.area}`;
      const status = [
        "Customer",
        "New Lead",
        "Interested",
        "Not Interested",
        "Contacted",
      ].includes(s.status)
        ? s.status
        : "Customer";
      await tx.query(
        `INSERT INTO shops(id,organization_id,name,contact,phone,area,location,notes,status,assigned_executive_id,created_by,created_at,synthetic)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)`,
        [
          syntheticId(`shop-${i + 1}`),
          org,
          name,
          s.contact,
          s.phone,
          s.area,
          s.location,
          "Fictional fixture for local review.",
          status,
          person(s.salespersonId),
          person(s.createdBy),
          `${s.createdAt}T12:00:00+04:00`,
        ],
      );
    }
    const now = Date.now();
    for (const v of source.visits) {
      const started = new Date(
        Math.min(+new Date(v.checkedInAt), now - 120000),
      );
      const ended = v.checkedOutAt
        ? new Date(Math.min(+new Date(v.checkedOutAt), now - 60000))
        : null;
      await tx.query(
        `INSERT INTO visits(id,organization_id,shop_id,visitor_id,created_by,checked_in_at,checked_out_at,lifecycle,outcome,notes,order_status,order_note,order_value,location)
        VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          syntheticId(v.id),
          org,
          syntheticId(v.shopId),
          person(v.salespersonId),
          started,
          ended,
          ended ? "completed" : "open",
          ended
            ? v.status === "Interested"
              ? "New Opportunity"
              : v.status
            : null,
          v.notes,
          v.orderStatus,
          v.orderNote,
          v.orderValue,
          JSON.stringify({ availability: "not_requested" }),
        ],
      );
    }
    for (const s of source.shops.filter((s: any) => s.nextFollowUp)) {
      const visit = source.visits.find(
        (v: any) => v.shopId === s.id && v.checkedOutAt,
      );
      if (!visit) continue;
      await tx.query(
        `INSERT INTO followups(id,organization_id,shop_id,visit_id,owner_id,created_by,due_date) VALUES($1,$2,$3,$4,$5,$5,$6)`,
        [
          syntheticId(`followup:${s.id}`),
          org,
          syntheticId(s.id),
          syntheticId(visit.id),
          person(visit.salespersonId),
          s.nextFollowUp,
        ],
      );
    }
  });
  return {
    organizationId: org,
    accounts,
    volume,
    seededOn: businessDay(new Date()),
  };
}
