# Source provenance and extraction record

- Export date: 2026-10-20 (UTC).
- Source directory: `C:\Users\USER\Desktop\Projects\Fusion Ventures Website`.
- Verified GitHub origin repository: `Fazilfazi991/fusionwebsite`.
- Branch: `main`.
- Repository HEAD: `4fd5bf3b1d0822a7190b4b8f153349134985c06c`.
- Most recent commit affecting the target HTML: `bbfc8f29b476af69c688d880d92b0b2885270270`, 2026-10-05, `Add CRM and Fusion Ventures favicon coverage`.
- Selected snapshot files match HEAD, including the original reference test. Copied bytes are verified against source with SHA-256.
- Working-tree caveat: the original repository has unrelated untracked `company-profile/` material and `scripts/hamdee-crm/production-baseline.test.cjs`. They were not copied. The export is a selected source snapshot, not a full working-tree archive. No tracked source changes were observed.
- Repository instruction check: no applicable `AGENTS.md`, `.agents`/`.codex` skill instructions or `SKILL.md` were found in the repository's relevant paths or checked parent directories. The Library skill was used for deliverable saving. No prior-session paths were accessed; source labels resolved the identity directly, so memory retrieval was unnecessary.

## Identity evidence

1. `app/business-software/softwareProjects.ts`, lines 386–413: slug `emerald-interlink`; title `Emerald Field Sales CRM`; type `Field Sales & Shop Visit CRM`; description names Emerald Interlink Trading L.L.C and building-materials shops; demo URL `/demo/emerald-interlink`.
2. Target `index.html`, title and sidebar: Emerald Field Sales CRM / Emerald Interlink Trading L.L.C / Field Sales CRM; modules and seed shops match the business brief.
3. `next.config.mjs` contains `{ source: '/demo/emerald-interlink', destination: '/demo/emerald-interlink/index.html' }`.
4. `docs/emerald-interlink-requirements.md` describes building-materials field sales. Separately, `docs/water-transport-crm-demo.md` is explicitly titled `AquaFleet CRM - water transport demo`. No AquaFleet source/data is included.

## Source mapping

| Original relative path | Snapshot relative path | Treatment |
| --- | --- | --- |
| `public/demo/emerald-interlink/index.html` | Same | Unchanged bytes. |
| `public/demo/emerald-interlink/favicon.svg` | Same | Unchanged bytes. |
| `docs/emerald-interlink-requirements.md` | `docs/original-requirements.md` | Unchanged bytes; renamed only for clarity. |
| `scripts/emerald-interlink/acceptance.cjs` | `reference-tests/original-acceptance.cjs` | Unchanged bytes; reference test only, no portability claim. |

All other package files are newly authored handoff documentation/manifests. No extraction refactor was necessary. The full Next.js package/config/lockfiles were excluded because the runtime has no imports from them; the one relevant rewrite is documented above and in README. The portfolio screenshot is not used by the demo runtime and was excluded. Other client demos, server APIs, Supabase material, company data, credentials, `.env*`, `.git`, `node_modules`, builds/caches and helper tooling are excluded by allowlist.

No separate license file was found in the selected source set. Ownership/licensing for future reuse remains a project-owner decision. This snapshot does not grant rights beyond the user's existing authority.
