# TypeScript compiler compatibility correction

20 October 2026. Baseline: `7d6da99f7fe81133cbc45bea0c1e8b6570b4e9f7`.

The supplied Vercel CLI 64.3.1 log shows the application's own build passing, followed by the backend builder failing at `ts.readConfigFile(tsconfig, ts.sys.readFile)`. Local inspection of TypeScript 7.0.2 reproduced `sys`, `readConfigFile` and `createProgram` all being undefined. Microsoft documents that TypeScript 7.0 does not ship a compiler API; tools needing the existing API must use the TypeScript 6 implementation. See [Microsoft's TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0).

## Change

Pin the development dependency to `typescript: 6.0.3` and update `pnpm-lock.yaml`. This restores the JavaScript compiler API and retains the `tsc` command. The lockfile removes the TypeScript 7 platform binaries; other dependency versions remain unchanged. Application source, permissions, database, migrations and runtime configuration are unchanged. The `node: >=22` warning is separate from this failure; no Node version change is included.

Keep the exact compiler pin until the selected builder supports a replacement compiler API and that combination has been verified. Do not bypass type checking to suppress the crash.

## Local verification

Windows, Node 22.22.0, pnpm 11.25.0:

- `pnpm install --frozen-lockfile`: passed.
- `pnpm run build`: passed with TypeScript 6.0.3.
- Compiler API probe using `readConfigFile`, `parseJsonConfigFileContent`, `createProgram` and `getPreEmitDiagnostics`: all 33 configured project files checked, zero diagnostics.
- Backend-specific API probe following the compiler operations/options in published `@vercel/backends@19.0.2` (the dependency of Vercel CLI 64.3.1), with `src/server.ts` as root, `allowJs`, `skipLibCheck` and `noEmit`: zero error diagnostics.
- `pnpm test`: 56 reported tests passed, zero failed, cancelled or skipped (52 leaf tests plus four parent entries).

These are local checks of the corrected dependency and compiler operations. They are not an executed Vercel build or hosted runtime acceptance. No deployment, project connection, environment pull, service provisioning or GitHub push was performed for this correction.

## Hosted runtime remains pending

The existing [staging plan](PHASE4-STAGING-PLAN.md) still applies. `src/config.ts` deliberately rejects production mode and non-loopback binding. Persistence uses local disk-backed PGlite; no network database adapter is implemented. Hosted entrypoint/bootstrap, migrations, persistent database configuration, HTTPS/proxy and session behavior, Chromium packaging, recovery and backup/restore require the planned implementation and verification before hosted acceptance. Removing the production guard or changing environment values alone is insufficient.

The correction is prepared on `fix/vercel-typescript-compatibility`. The owner has independently connected GitHub to Vercel; a push to the connected branch may trigger a deployment. Leave that release action for explicit owner authorization under the existing no-deployment restriction.
