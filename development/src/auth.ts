import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import {readQuery,type Database,type Queryable} from "./database.js";
import { Fault, type Actor, type Role } from "./domain.js";
const derive = promisify(scrypt);
export const hashToken = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export async function passwordRequestFingerprint(
  password: string,
  requestKey: string,
) {
  // Keep retry comparison as expensive as password verification; never store a fast password digest.
  return (
    (await derive(
      password,
      `emerald-account-retry-v1:${requestKey}`,
      64,
    )) as Buffer
  ).toString("hex");
}
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await derive(password, salt, 64)) as Buffer;
  return `scrypt-v1:${salt}:${key.toString("hex")}`;
}
export async function passwordMatches(password: string, encoded: string) {
  const [scheme, salt, stored] = encoded.split(":");
  if (scheme !== "scrypt-v1" || !salt || !stored) return false;
  const key = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(stored, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export async function createAccount(
  db: Queryable,
  org: string,
  email: string,
  name: string,
  role: Role,
  password: string,
) {
  const id = randomUUID();
  await db.query(
    "INSERT INTO users(id,email,name,password_hash) VALUES ($1,$2,$3,$4)",
    [id, email.toLowerCase(), name, await passwordHash(password)],
  );
  await db.query(
    "INSERT INTO memberships(organization_id,user_id,role) VALUES ($1,$2,$3)",
    [org, id, role],
  );
  return id;
}
export interface Session {
  actor: Actor;
  csrf: string;
  token: string;
}
export async function readSession(
  db: Queryable,
  cookie = "",
): Promise<Session> {
  const token = cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("emerald_session="))
    ?.slice(16);
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new Fault(401, "UNAUTHENTICATED", "Sign in to continue.");
  const row = (
    await readQuery<Actor & { csrf: string }>(db,
      `SELECT u.id,u.name,m.role,m.organization_id AS "organizationId",s.csrf_token AS csrf
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=u.id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
      [hashToken(token)],
    )
  ).rows[0];
  if (!row)
    throw new Fault(
      401,
      "UNAUTHENTICATED",
      "Your session has expired. Sign in again.",
    );
  const { csrf, ...actor } = row;
  return { actor, csrf, token };
}
export async function login(
  db: Database,
  email: string,
  password: string,
  ip: string,
) {
  const buckets = [
    [hashToken(`account:${ip}:${email.toLowerCase()}`), 10],
    [hashToken(`ip:${ip}`), 100],
  ] as const;
  await db.transaction(async (tx) => {
    for (const [key, limit] of buckets) {
      const r = (
        await tx.query<{ attempts: number }>(
          `INSERT INTO login_attempts(key_hash,attempts,reset_at) VALUES ($1,1,now()+interval '15 minutes')
        ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN login_attempts.reset_at<=now() THEN 1 ELSE login_attempts.attempts+1 END,
        reset_at=CASE WHEN login_attempts.reset_at<=now() THEN now()+interval '15 minutes' ELSE login_attempts.reset_at END RETURNING attempts`,
          [key],
        )
      ).rows[0];
      if (r.attempts > limit)
        throw new Fault(
          429,
          "RATE_LIMIT",
          "Too many sign-in attempts. Try again in 15 minutes.",
        );
    }
  });
  const row = (
    await db.query<{ id: string; password_hash: string }>(
      `SELECT id,password_hash FROM users WHERE email=$1 AND active`,
      [email.toLowerCase()],
    )
  ).rows[0];
  const dummy = "scrypt-v1:00000000000000000000000000000000:" + "0".repeat(128);
  const matches = await passwordMatches(password, row?.password_hash ?? dummy);
  if (!row || !matches)
    throw new Fault(401, "INVALID_LOGIN", "Email or password is incorrect.");
  const token = randomBytes(32).toString("hex"),
    csrf = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    // Serialize session creation with account disabling and password resets.
    // The password was verified before this transaction; reject it if either
    // the active state or hash changed while that verification was in flight.
    const current = (await tx.query<{ active: boolean; password_hash: string }>(
      "SELECT active,password_hash FROM users WHERE id=$1 FOR UPDATE",
      [row.id],
    )).rows[0];
    if (!current?.active || current.password_hash !== row.password_hash)
      throw new Fault(401, "INVALID_LOGIN", "Email or password is incorrect.");
    await tx.query("DELETE FROM sessions WHERE expires_at<=now()");
    await tx.query(
      "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '12 hours')",
      [hashToken(token), row.id, csrf],
    );
    await tx.query("DELETE FROM login_attempts WHERE key_hash=$1", [
      buckets[0][0],
    ]);
  });
  return { token, csrf };
}
