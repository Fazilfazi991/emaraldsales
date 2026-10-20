import { openDatabase } from "../src/database.js";
import { config } from "../src/config.js";
import { createAccount } from "../src/auth.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
// Host operator bootstrap. No password on a command line or in shell history.
const [email, name, role, passwordFile] = process.argv.slice(2);
if (!passwordFile)
  throw new Error(
    'Usage: pnpm account:create email "Name" executive|manager|admin path-to-private-password-file',
  );
z.string().email().parse(email);
z.string().min(1).max(120).parse(name);
const validRole = z.enum(["executive", "manager", "admin"]).parse(role);
const password = (await readFile(passwordFile, "utf8")).trim();
z.string().min(14).max(128).parse(password);
const db = await openDatabase(config().dataDir);
try {
  await db.transaction(async (tx) => {
    let org = (
      await tx.query<{ id: string }>("SELECT id FROM organizations LIMIT 1")
    ).rows[0]?.id;
    if (!org) {
      org = randomUUID();
      await tx.query("INSERT INTO organizations(id,name) VALUES($1,$2)", [
        org,
        "Emerald Interlink Trading L.L.C",
      ]);
    }
    const id = await createAccount(tx, org, email, name, validRole, password);
    console.log(`Created ${validRole}: ${email} (${id})`);
  });
} finally {
  await db.close();
}
