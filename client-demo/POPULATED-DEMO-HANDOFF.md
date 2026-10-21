# Populated Delivery & Collections demo — owner review

21 October 2026 · Asia/Dubai · DEMO — Sample Data.

Branch `demo/populated-collections` starts from accepted delivery demo `6c953e178431c217c2ac7bd2fc307212df2d72a9`. This change adds fictional saved records only; it does not redesign the interface, change financial rules or introduce any backend/service integration.

## Today at first initialization / upgrade

| Fictional shop | Cash AED | Credit AED | Cheque AED | Scenario |
| --- | ---: | ---: | ---: | --- |
| Demo Crescent Hardware | 300 | 0 | 0 | Full cash |
| Demo Horizon Sanitary | 200 | 150 | 0 | Partial cash and credit |
| Demo City Tools | 0 | 420 | 0 | Credit only |
| Demo Marina Building Supplies | 0 | 0 | 275 | Cheque received |
| Demo Palm Hardware | 125 | 75 | 200 | Mixed settlement |
| Demo Star Fix Trading | 180 | 0 | 0 | Older-bill collection, no delivery |
| **Totals** | **805** | **645** | **475** | **5 completed deliveries** |

Older-bill cash **180** is already included in cash **805**. The two cheque instruments have invented `DEMO-CHQ` references and dates; neither is cleared cash. Invented `DEMO-INV` and `DEMO-RV` references are supplied throughout. No invoice balance, formal Zoho transaction or accounting reconciliation is inferred.

Six valid fictional shops are added, preserving the original 700. All new records are marked by the sample fixture marker and have deterministic IDs. Two recent UAE dates have three additional deliveries: yesterday cash 90 and credit 60; two days ago cheque 110. The fixed 17 October reference date is reserved and excluded from new scenario seeding, including relative-date collisions, so its 13 original collections remain exactly **1,610 cash / 2,562 credit / 0 cheques**.

Samir has completed prior-day shifts: 08:00–15:00 with an 11:30–12:00 break (6h 30m net), and 08:00–16:00 with a 12:00–12:30 break (7h 30m net). At or after 10:00 UAE, today's completed morning demonstration session is 08:00–10:00 with a 09:00–09:15 break (1h 45m net). Before 10:00, no completed session is invented today. An overlapping existing Samir session prevents that sample shift from being added. No open sample duty blocks Start Duty. These are demonstrations, not payroll or full-day attendance claims.

Three additional fictional executive visits have discussions; two record optional confirmed amounts 850 and 350, total **1,200**. These remain separate from delivery receipts. Existing visit notes, follow-ups and attendance records are retained.

## Existing data and date behavior

`populateSamples` runs once per browser-local dataset using `sample_data.version = 1`. It builds an additive clone, creates deliveries and payment components through the existing validated transaction function, and saves the whole upgrade in one localStorage write. Existing shops, user receipts, visits, discussions, follow-ups, duty, breaks, audit, profile selection, revisions and retry keys are preserved. Storage failure leaves the original raw value intact. ID collisions or an unknown sample version stop with an error rather than overwriting records.

Examples use the **current UAE date when the dataset is first loaded/upgraded/reset**. Their saved timestamps never move forward on refresh or role switching. Reopening on a later day does not invent another day's receipts: select the saved sample date to review them, or explicitly confirm Reset Demo Data to recreate today's fictional examples. Reset removes user-created demo examples too, as its existing confirmation explains. Correct device time is required.

New Preview URLs are separate browser origins, so they begin with independent samples; the previous Preview's saved records are not transferred or erased. The migration preserves data when this version is served on an existing origin. Demo roles/localStorage are not real authentication or a financial ledger.

## Verification

Both normal and static builds passed. **106 regular automated tests passed (0 failed/skipped)**, including seven new sample-data regressions for exact amounts, historical isolation, chronological duty/net hours, v1/v2 preservation and quota failure, idempotent refresh/reopen/reset, ID collisions and Excel/print totals.

Local Chromium acceptance passed **13 populated-data checkpoints + 16 manual-collection checkpoints + 31 existing visit/attendance checkpoints**. Checks cover fresh and initialized browsers, same-origin reopening, role switching, reset, saved custom receipts, filters, new duty/break/return/end after seeded shifts, financial retries and failure feedback. Required widths: 390, 430, 768, 1024 and 1440px. Ten Excel and ten genuine browser-generated PDF downloads were checked across the three suites. The two populated/reference slips were rendered and visually inspected: one portrait page each, readable references/totals and embedded fonts. Existing Unicode and retry regressions remain in the manual suite. No physical-device or native printer testing is claimed.

Evidence: `development/evidence/populated-collections/local`, `manual-regression` and `regression`. Test harness: `development/scripts/populated-demo-browser.ts`. Tests/builds execute locally with Node 22 and pinned pnpm. To repeat browser testing, build `client-demo`, then from `development` run `node --import tsx scripts/populated-demo-browser.ts` (and the existing collections/attendance harnesses), setting `DEMO_EVIDENCE_DIR` to a new evidence path. Use `DEMO_BASE_URL` only for an approved isolated static Preview.

## Owner walkthrough

1. Open the new Preview and choose **Delivery Person · Samir Demo**. Today shows 5 / 805 / 645 / 475, with old-bill 180 explicitly included in cash. Scroll to the populated slip.
2. Review duty hours and Duty history; Start Duty still starts a new session normally.
3. Switch to Manager in the same browser. Overview shows staff attendance, executive visits/follow-ups and separate confirmed values. Collections → Samir shows the matching figures.
4. Download Excel or Print / Save as PDF. Try yesterday's date, then Reference slip; confirm their distinct totals.
5. Record a fictional receipt, refresh and switch roles; verify it remains once. Reset requires confirmation and restores the seeded examples.

No original collection-slip photo, actual customer/staff names or actual invoice/voucher references are used in the new fixture. No backend source, migrations, dependencies, production aliases, Supabase/PostgreSQL, Zoho, payment service, real account or real-data import is changed. Existing correction/cheque-clearing policy decisions remain pending as documented in `DELIVERY-COLLECTIONS-HANDOFF.md`.

## Publication

Pending verified source push and an isolated static Preview in the existing `emerald-sales-client-demo` project. Original `development` project, main and backend branches must remain untouched. Owner review and physical-phone/client acceptance remain pending.
