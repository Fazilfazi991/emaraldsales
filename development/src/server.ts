import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { ZodError, z } from "zod";
import { openDatabase, type Database } from "./database.js";
import { config, type Config } from "./config.js";
import { readSession, login, hashToken } from "./auth.js";
import { CRM } from "./service.js";
import { Fault, type DutyAction } from "./domain.js";

async function jsonBody(req: IncomingMessage) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new Fault(415, "JSON_REQUIRED", "Use application/json.");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768)
      throw new Fault(413, "TOO_LARGE", "Request exceeds 32KB.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Fault(400, "INVALID_JSON", "Invalid JSON body.");
  }
}
export function application(db: Database, settings: Config) {
  const crm = new CRM(db, settings);
  const cookie = (value: string, age = 43200) =>
    `emerald_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${settings.secure ? "; Secure" : ""}`;
  return createServer(async (req, res) => {
    const requestId = randomUUID();
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(self), camera=(), microphone=()",
    );
    const send = (status: number, data: unknown) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url ?? "/", settings.origin),
        path = url.pathname,
        method = req.method;
      // A single exact origin for local access also prevents cross-site writes and DNS rebinding.
      if (req.headers.host !== new URL(settings.origin).host)
        throw new Fault(
          403,
          "INVALID_HOST",
          "Use the configured application URL.",
        );
      if (
        method !== "GET" &&
        method !== "HEAD" &&
        req.headers.origin !== settings.origin
      )
        throw new Fault(
          403,
          "ORIGIN_DENIED",
          "Use this application to submit changes.",
        );
      if (!path.startsWith("/api/")) {
        if (method !== "GET" && method !== "HEAD")
          throw new Fault(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        const assets: Record<string, [string, string]> = {
          "/": ["index.html", "text/html; charset=utf-8"],
          "/app.js": ["app.js", "text/javascript; charset=utf-8"],
          "/style.css": ["style.css", "text/css; charset=utf-8"],
          "/brand.png": ["brand.png", "image/png"],
          "/favicon.svg": ["favicon.svg", "image/svg+xml"],
        };
        const asset = assets[path];
        if (!asset) throw new Fault(404, "NOT_FOUND", "Page not found.");
        res.setHeader("Content-Type", asset[1]);
        const bytes = await readFile(
          new URL(`../dist/${asset[0]}`, import.meta.url),
        );
        res.end(method === "HEAD" ? undefined : bytes);
        return;
      }
      if (path === "/api/login" && method === "POST") {
        const body = z
          .object({
            email: z.string().email().max(254),
            password: z.string().min(1).max(128),
          })
          .strict()
          .parse(await jsonBody(req));
        const session = await login(
          db,
          body.email,
          body.password,
          req.socket.remoteAddress ?? "unknown",
        );
        res.setHeader("Set-Cookie", cookie(session.token));
        send(200, { csrf: session.csrf });
        return;
      }
      const session = await readSession(db, req.headers.cookie);
      if (method !== "GET" && req.headers["x-csrf-token"] !== session.csrf)
        throw new Fault(
          403,
          "CSRF_DENIED",
          "Your form session is invalid. Reload and try again.",
        );
      const key =
        typeof req.headers["idempotency-key"] === "string"
          ? req.headers["idempotency-key"]
          : undefined;
      const actor = session.actor;
      if (path === "/api/me" && method === "GET") {
        send(200, {
          actor,
          csrf: session.csrf,
          policies: { visit: settings.visitPolicy, duty: settings.dutyPolicy },
          timezone: "Asia/Dubai",
        });
        return;
      }
      if (path === "/api/logout" && method === "POST") {
        await db.query("DELETE FROM sessions WHERE token_hash=$1", [
          hashToken(session.token),
        ]);
        res.setHeader("Set-Cookie", cookie("", 0));
        send(200, { ok: true });
        return;
      }
      if (path === "/api/dashboard" && method === "GET") {
        send(200, await crm.dashboard(actor));
        return;
      }
      if (path === "/api/metadata" && method === "GET") {
        const team = (
          await db.query(
            "SELECT u.id,u.name,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=$1 AND u.active ORDER BY u.name",
            [actor.organizationId],
          )
        ).rows;
        const areas = (
          await db.query<{ area: string }>(
            "SELECT DISTINCT area FROM shops WHERE organization_id=$1 ORDER BY area",
            [actor.organizationId],
          )
        ).rows.map((r) => r.area);
        send(200, { team, areas });
        return;
      }
      if (path === "/api/shops" && method === "GET") {
        send(200, await crm.listShops(actor, url.searchParams));
        return;
      }
      const shop = path.match(/^\/api\/shops\/([^/]+)$/);
      if (shop && method === "GET") {
        send(200, await crm.profile(actor, z.string().uuid().parse(shop[1])));
        return;
      }
      const shopAudit = path.match(/^\/api\/shops\/([^/]+)\/audit$/);
      if (shopAudit && method === "GET") {
        send(200, await crm.shopAudit(actor, z.string().uuid().parse(shopAudit[1]), url.searchParams));
        return;
      }
      const shopChange = path.match(/^\/api\/shops\/([^/]+)\/(update|transfer)$/);
      if (shopChange && method === "POST") {
        const id = z.string().uuid().parse(shopChange[1]);
        const body = await jsonBody(req);
        send(200, shopChange[2] === "update" ? await crm.updateShop(actor, key, id, body) : await crm.transferShop(actor, key, id, body));
        return;
      }
      if (path === "/api/visits" && method === "GET") {
        send(200, await crm.visits(actor, url.searchParams));
        return;
      }
      if (path === "/api/checkin" && method === "POST") {
        send(200, await crm.checkin(actor, key, await jsonBody(req)));
        return;
      }
      const checkout = path.match(/^\/api\/visits\/([^/]+)\/checkout$/);
      if (checkout && method === "POST") {
        send(
          200,
          await crm.checkout(
            actor,
            key,
            z.string().uuid().parse(checkout[1]),
            await jsonBody(req),
          ),
        );
        return;
      }
      if (path === "/api/leads" && method === "POST") {
        send(200, await crm.lead(actor, key, await jsonBody(req)));
        return;
      }
      const followup = path.match(/^\/api\/followups\/([^/]+)$/);
      if (path === "/api/followups" && method === "POST") {
        send(200, await crm.createFollowup(actor, key, await jsonBody(req)));
        return;
      }
      const followupAssign = path.match(/^\/api\/followups\/([^/]+)\/assign$/);
      if (followupAssign && method === "POST") {
        send(200, await crm.assignFollowup(actor, key, z.string().uuid().parse(followupAssign[1]), await jsonBody(req)));
        return;
      }
      if (followup && method === "POST") {
        send(
          200,
          await crm.updateFollowup(
            actor,
            key,
            z.string().uuid().parse(followup[1]),
            await jsonBody(req),
          ),
        );
        return;
      }
      if (path === "/api/duty" && method === "GET") {
        send(
          200,
          await crm.dutyHistory(
            actor,
            url.searchParams.get("person") ?? undefined,
          ),
        );
        return;
      }
      const duty = path.match(/^\/api\/duty\/(start|rest|return|end)$/);
      if (duty && method === "POST") {
        send(
          200,
          await crm.duty(
            actor,
            key,
            duty[1] as DutyAction,
            await jsonBody(req),
          ),
        );
        return;
      }
      if (path === "/api/accounts" && method === "GET") {
        send(200, await crm.accounts(actor));
        return;
      }
      if (path === "/api/accounts" && method === "POST") {
        send(200, await crm.addAccount(actor, key, await jsonBody(req)));
        return;
      }
      // Corrections, generic exports/imports and lead conversion still need explicit policies.
      if (
        /^\/api\/(imports|exports|corrections|assignments|conversions)(\/|$)/.test(
          path,
        )
      )
        throw new Fault(
          409,
          "POLICY_PENDING",
          "This operation is unavailable pending its business policy and implementation.",
        );
      throw new Fault(404, "NOT_FOUND", "API route not found.");
    } catch (error) {
      if (error instanceof Fault) {
        send(error.status, {
          error: { code: error.code, message: error.message },
          requestId,
        });
        return;
      }
      if (error instanceof ZodError) {
        send(422, {
          error: {
            code: "VALIDATION",
            message: "Please check the submitted fields.",
            fields: error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          requestId,
        });
        return;
      }
      // No request bodies, cookies, passwords or location coordinates in logs.
      console.error(
        JSON.stringify({
          requestId,
          error: error instanceof Error ? error.message : "Unexpected error",
        }),
      );
      send(500, {
        error: {
          code: "INTERNAL",
          message:
            "The server could not confirm this action. Retry with the same request key.",
        },
        requestId,
      });
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const settings = config(),
    db = await openDatabase(settings.dataDir);
  const applied = (
    await db.query<{ name: string }>(
      "SELECT name FROM schema_migrations WHERE name='003_phase2_visits_and_shop_versions.sql'",
    )
  ).rows;
  if (!applied.length) {
    await db.close();
    throw new Error("Run pnpm db:migrate first.");
  }
  const server = application(db, settings);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(settings.port, settings.host, () =>
    console.log(`Emerald CRM: ${settings.origin} (synthetic local workspace)`),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () =>
      server.close(() => {
        void db.close().then(() => process.exit(0));
      }),
    );
}
