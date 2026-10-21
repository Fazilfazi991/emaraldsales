# Emerald client demonstration handoff

21 October 2026, Asia/Dubai. Ready for synthetic UI/workflow review; this is not real-client production acceptance.

## Open the demo

**[Live public demo](https://emerald-sales-client-demo-6f2e5btlt-faziils-projects.vercel.app)**

Vercel project `emerald-sales-client-demo` (`prj_pSdVrjDpiMvOphxDcJ36g9VMTx5S`), team `faziils-projects`. Final deployment `dpl_DjaAySGG3JEsaJo4n8tR5oy6qd93`, status **READY**, environment **Preview** (`target: null`). Framework Other/static, root `client-demo`, Node 22 build, output `dist`. Vercel's actual resource inventory lists **14 static assets**, without a Functions section. The project overview showed zero function invocations. No serverless initialization, database or production CRM API is needed.

Source branch: [demo/client-review](https://github.com/Fazilfazi991/emaraldsales/tree/demo/client-review). **Deployed application commit: `3c2e7e613e123e82ec198f61aa2fd60294fe6db7`.** The subsequent handoff commit contains documentation and final HTTPS verification evidence only; the deployed application source is unchanged. Use `git log -1` for that evidence commit's exact SHA.

An initial API request explicitly containing `target: "preview"` was unexpectedly classified as **Production / Staged**, not promoted. Cancellation was attempted after the build had already reached READY and returned `deployment_not_canceled`; nothing was canceled. No production deployment was promoted or existing alias assigned. The project overview's “No Production Deployment” and branch Preview link initially obscured the staged environment; the detailed view clarified it. Following Vercel's documented API behavior, a second request **omitted target** and used the demo branch, producing the final true Preview linked above. The unused first build `dpl_9GuRK4hFonhiVttrL249G64Dmf5N` remains staged and is not the client handoff. No additional plan, paid add-on or service was purchased; the team dashboard identifies the existing plan as Hobby.

## What is functional

- The existing Emerald interface, colors, branding, executive daily screen, navigation, shop profiles, short visit forms and manager dashboard are reused.
- Choose Manager or one of Ahmed Hassan, Shihab K. and Naseer M. These are fictional profiles for role demonstration, not authenticated accounts.
- Start duty, take/return from a break and end duty independently from visits. Search 700 fictional shops, read history, check in, record discussion/outcome, check out, and review today's visits.
- Add, complete, cancel or reschedule independent follow-ups. A later visit retains older follow-ups. Manager assignments/transfers require a reason and preserve local record history. Another executive can visit the same shop; a visit does not transfer the shop.
- Managers see current sample attendance, visits, follow-ups and shop history. Staff/date filters affect report rows, metadata and totals. Native Excel and clearly labelled Print / Save as PDF work for visits, duty/breaks and follow-ups.
- Refresh, role switching, same-key retries and Reset Demo Data work. Validation, stale-version checks, one-active-visit and duty transitions are demonstrated locally using the existing domain validators. Demo history is browser-editable and does not replace secure backend auditing.

## Verification results

| Check | Result |
| --- | --- |
| Normal CRM TypeScript/client build | Passed; default transport still calls the authenticated backend |
| Full automated suite | **72 passed**, zero failed/cancelled/skipped: existing 63 plus nine demo tests |
| Static demo build | Passed locally and on Vercel's Linux builder; no Node server/auth/database module enters the client bundle |
| Final HTTPS browser journey | **15 checkpoints passed**, with a new browser context and no Vercel cookies or bypass token |
| Executive and manager layouts | Passed at **390, 430, 768, 1024, 1440px**, with no horizontal overflow |
| Native Excel | Three downloaded workbooks reopened successfully; sample label, metadata and Arabic/Malayalam activity values verified |
| Print / Save as PDF | Three print views opened successfully; real headless-browser PDFs generated for evidence |
| Unicode PDF review | Final activity PDF rendered with Poppler; Arabic and Malayalam readable, extracted characters present, four embedded Noto font subsets identified |
| Public/touch access | Separate anonymous 390px touch/mobile emulation passed; two independent contexts proved local states do not synchronize |
| Refresh and reset | Open visits, duty/break state, role and saved records survived refresh. Reset restored 700 shops and removed user-added samples |
| Network and console | Zero unexpected API/external requests, failed asset responses or uncaught/console errors during the final journey |
| Static safety headers | `connect-src 'none'`, `form-action 'none'`; geolocation/camera/microphone disabled |
| Publication scan | Staged and reachable-history Gitleaks found no leaks. History/binary review found no private local passwords or prohibited files; invalid-domain URL tests and randomized test-password prefixes were reviewed as fixtures |

Browser tests were Chromium with viewport/touch emulation, **not physical-phone testing**. Human client approval and actual Android/iPhone checks remain to be completed. There was no hosted database integration test for this static demo because no hosted database exists or was connected.

Evidence: [HTTPS verification](../development/evidence/client-demo/verification.json), [touch/browser isolation check](../development/evidence/client-demo/mobile-probe.json), [executive mobile screenshot](../development/evidence/client-demo/executive-390.png), [manager desktop screenshot](../development/evidence/client-demo/manager-1440.png). Other widths, three sample Excel files and three browser-generated PDF samples are in the same directory. These are synthetic acceptance artifacts, not actual company reports.

## Simple client walkthrough

1. Open the demo link in a normal or incognito browser. Choose **Sales Executive · Ahmed Hassan**.
2. Start duty → Search shops → search **Al Noor** → open the shop → Check in.
3. Complete visit → choose an outcome → enter a fictional discussion → optionally set a follow-up date → Check Out · Save Visit.
4. In Follow-ups, add/reschedule/complete an item. Return to Today, start a break, return to duty and end duty. Refresh to see that local changes remain.
5. Choose **Switch role**, then **Manager**. Review staff activity, choose Ahmed and dates, review visits or follow-ups, and open a shop's history.
6. Select Visits / Duty and breaks / Follow-ups. Choose **Excel**, or **Print / Save as PDF**, then Save as PDF in the browser print dialog. Allow the report popup for this site if needed.
7. **Reset Demo Data** restores the samples after confirmation. Use only fictional details while reviewing.

## Storage and security boundaries

**No Supabase, PostgreSQL or external backend service was provisioned or connected. No database credentials, hosted secrets, real staff accounts, real customers, GPS data or Zoho connection were created/imported.** There is no secure authentication in this demo and no claim of shared-database storage.

The data key `emerald-client-demo-v1` belongs to this site's browser-local storage. Refresh and role switching reuse it; other browsers, incognito contexts, devices or preview URLs have separate copies. Clearing site data or closing incognito sessions loses changes. The device clock drives sample timestamps and UAE business dates. Do not put real customer information into the demo. It does not synchronize records or provide backups.

Existing remote branches were preserved:

| Branch | Unchanged SHA |
| --- | --- |
| `main` | `9296cf36c94173e418abf1e57a367bdb48c3ff8c` |
| `prep/vercel-staging` | `825db7a09a07e9053b1f48a898ad2e6b5cb60332` |
| `fix/vercel-function-entrypoint` | `529fcd2e80edaaabf3411a429c148c470d09c314` |

The existing Vercel `development` project still reports original deployment `dpl_7HYdjP8TYFCctHsvUiD9KsiU9rb2`, original aliases and Node 24 setting. It was inspected read-only. Its deployment protection remains enabled. Neither staging PR was merged. Automatic Git deployments remain disabled in both configurations; the new demo project is not connected for automatic Git releases.

## After client approval

The [demo build/readme](README.md) explains the adapter boundary and local commands. Do not convert demo roles into real authentication or import local demo state into a database. Record approved workflow decisions, then separately approve provider/region/budget, restricted PostgreSQL roles, TLS/pooling, secrets, migrations, synthetic seed, backups/restore, account recovery and hosted acceptance under the existing [staging plan](../development/docs/VERCEL-STAGING-PREPARATION.md).

The normal `development` build uses `client/transport.ts` and authenticated server APIs; the static build alone aliases it to `demo/transport.ts`. Reuse the accepted screens with the normal backend, independently review the existing staging/runtime PRs, run secure hosted acceptance, and obtain production/data-import approval separately.

No known blocker remains to sharing this synthetic preview for UI/business-process review. Actual-phone checks and human client acceptance remain outstanding. Popup restrictions may require allowing the print window. Real operations remain blocked until the separate backend/staging approvals and verification are completed.
