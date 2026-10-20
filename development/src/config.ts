import { resolve } from "node:path";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
export interface Config {
  host: string;
  port: number;
  origin: string;
  dataDir: string;
  secure: boolean;
  visitPolicy: string;
  dutyPolicy: string;
}
export function config(): Config {
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "Hosted production is not configured. Review staging/release plan first.",
    );
  const host = process.env.HOST ?? "127.0.0.1";
  if (!["127.0.0.1", "localhost", "::1"].includes(host))
    throw new Error("Local foundation must bind to loopback.");
  const port = Number(process.env.PORT ?? 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  const origin = process.env.APP_ORIGIN ?? `http://127.0.0.1:${port}`;
  if (new URL(origin).origin !== origin)
    throw new Error("APP_ORIGIN must be an exact origin");
  for (const policy of [process.env.VISIT_POLICY, process.env.DUTY_POLICY])
    if (policy && !["pending", "approved-v1"].includes(policy))
      throw new Error("Unknown business policy");
  return {
    host,
    port,
    origin,
    dataDir: resolve(process.env.DATA_DIR ?? ".data/crm"),
    secure: process.env.COOKIE_SECURE === "true",
    visitPolicy: process.env.VISIT_POLICY ?? "pending",
    dutyPolicy: process.env.DUTY_POLICY ?? "approved-v1",
  };
}
