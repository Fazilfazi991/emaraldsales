import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
const script = fileURLToPath(new URL("../scripts/build.mjs", import.meta.url));
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "emerald-browser-build-"));
  await mkdir(join(root, "client")); await mkdir(join(root, "dist"));
  await writeFile(join(root, "client/app.ts"), "document.title='Browser only';");
  for (const name of ["index.html", "style.css", "brand.png", "favicon.svg"])
    await writeFile(join(root, "client", name), "synthetic build fixture");
  return root;
}
async function removeFixture(root: string) {
  const target = resolve(root);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("emerald-browser-build-"))
    throw new Error("Refusing to remove an unexpected fixture path");
  await rm(target, { recursive: true, force: true });
}
test("Browser build removes a cached app.js and emits no Node-detectable entrypoint", async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, "dist/app.js"), "document.title='Stale browser bundle';");
    await execute(process.execPath, [script], { cwd: root });
    await assert.rejects(() => access(join(root, "dist/app.js")));
    assert.match(await readFile(join(root, "dist/emerald-client.js"), "utf8"), /document/);
  } finally { await removeFixture(root); }
});
test("Browser build refuses another cached server-looking output instead of packaging it", async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, "dist/server.js"), "document.title='Wrong entry';");
    await assert.rejects(() => execute(process.execPath, [script], { cwd: root }), /Browser output contains a server entrypoint name/);
  } finally { await removeFixture(root); }
});
