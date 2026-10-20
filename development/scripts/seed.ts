import { mkdir, writeFile, access } from "node:fs/promises";
import { openDatabase } from "../src/database.js";
import { config } from "../src/config.js";
import { seedSynthetic } from "../src/fixtures.js";
if (!process.argv.includes("--synthetic"))
  throw new Error(
    "Only synthetic fixtures are supported. Run pnpm db:seed --synthetic [36..5000].",
  );
const count = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 700);
let credentialFileExists = false;
try {
  await access(".local/accounts.json");
  credentialFileExists = true;
} catch {}
if (credentialFileExists)
  throw new Error(
    "Existing .local/accounts.json found. Preserve it separately before seeding a different empty review database.",
  );
const db = await openDatabase(config().dataDir);
try {
  const result = await seedSynthetic(db, count);
  await mkdir(".local", { recursive: true });
  await writeFile(".local/accounts.json", JSON.stringify(result, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
  console.log(
    `Seeded ${result.volume} synthetic shops. Random local credentials: .local/accounts.json (gitignored).`,
  );
} finally {
  await db.close();
}
