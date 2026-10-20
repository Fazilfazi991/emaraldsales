import type { Config } from "./config.js";
import { postgresPoolOptions, type PostgresSettings } from "./postgres.js";

export function hostedConfig(env: NodeJS.ProcessEnv = process.env): { app: Config; database: PostgresSettings } {
  if (env.VERCEL !== "1" || env.NODE_ENV !== "production" || env.CRM_HOSTED_STAGE !== "approved-synthetic-staging")
    throw new Error("Hosted staging approval is missing");
  let url: URL;
  try { url = new URL(env.APP_ORIGIN ?? ""); } catch { throw new Error("Hosted HTTPS origin is required"); }
  if (url.protocol !== "https:" || url.origin !== env.APP_ORIGIN || url.username || url.password || url.port
      || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Hosted HTTPS origin must be exact");
  if (env.VISIT_POLICY !== "approved-v2" || env.DUTY_POLICY !== "approved-v1")
    throw new Error("Explicit operational policies are required");
  const database: PostgresSettings = { connectionString: env.DATABASE_URL ?? "", ca: env.DATABASE_SSL_CA, max: 3 };
  postgresPoolOptions(database); // Validate before opening any connection. Never fall back to local disk.
  return { database, app: { host: "127.0.0.1", port: 0, origin: url.origin, dataDir: "", secure: true,
    visitPolicy: env.VISIT_POLICY, dutyPolicy: env.DUTY_POLICY, trustedProxy: "vercel" } };
}
