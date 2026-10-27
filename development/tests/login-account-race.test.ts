import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, migrate, type Database } from "../src/database.js";
import { seedSynthetic } from "../src/fixtures.js";
import { login, passwordHash } from "../src/auth.js";
import { Fault } from "../src/domain.js";

// Inject the concurrent change after login has verified its initial snapshot
// but before its session-creation transaction. This is the dangerous ordering
// regardless of how long password hashing or a real database lock takes.
for (const change of ["disable", "reset"] as const) {
  test(`login refuses a stale password verification after account ${change}`, async () => {
    const db = await openDatabase();
    try {
      await migrate(db);
      const { accounts } = await seedSynthetic(db, 36);
      const person = accounts.find(a => a.role === "executive")!;
      const replacement = await passwordHash("synthetic-replacement-password");
      let transactions = 0;
      const interleaved: Database = {
        query: db.query.bind(db),
        close: db.close.bind(db),
        transaction: async work => {
          if (++transactions === 2) {
            await db.transaction(async tx => {
              if (change === "disable")
                await tx.query("UPDATE users SET active=false WHERE id=$1", [person.id]);
              else
                await tx.query("UPDATE users SET password_hash=$2 WHERE id=$1", [person.id, replacement]);
              await tx.query("DELETE FROM sessions WHERE user_id=$1", [person.id]);
            });
          }
          return db.transaction(work);
        },
      };
      await assert.rejects(login(interleaved, person.email, person.password, "127.0.0.1"),
        (error: unknown) => error instanceof Fault && error.code === "INVALID_LOGIN");
      if (change === "disable") await db.query("UPDATE users SET active=true WHERE id=$1", [person.id]);
      const sessions = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM sessions WHERE user_id=$1", [person.id]);
      assert.equal(sessions.rows[0].count, 0);
    } finally {
      await db.close();
    }
  });
}
