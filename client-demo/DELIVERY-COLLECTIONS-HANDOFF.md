# Delivery & Collections — owner review

21 October 2026, Asia/Dubai. Synthetic static demo only. Owner visual approval and client acceptance are pending.

## Source and scope

Branch `demo/delivery-collections` descends from accepted attendance commit `f053278a482b59f7673221d8935a0de8ace60730`. It also retains the prepared simplified checkout commit `2689aeebbc0e823df5bca48ee397c66e72ea0db4`. No main, backend, PostgreSQL staging or existing demo branch is merged or overwritten.

The normal authenticated CRM transport and backend authorization remain unchanged. Only the static demo aliases its transport to the browser-local adapter. No new dependency or hosted service is needed.

## What works

- The salesman still completes a visit with outcome, one discussion field and an optional follow-up. A collapsed **Confirmed order amount (optional)** field reuses the existing order-value/status record. Entering an amount records Order Received; blank means No Order. The manager sees manually recorded confirmed values by staff and checkout date, separately from delivery collections. This does not create a formal order or invoice.
- **Delivery Person · Samir Demo** is a fictional role, appended without changing existing profile IDs. It has My Deliveries, Record Delivery and Today's Collections, plus the existing duty start/break/return/end and running duty/break/net hours. The manager's attendance view includes delivery staff, while sales-team visit cards retain their sales meaning.
- Delivery staff choose a saved shop through search, enter an existing invoice and an optional manually issued voucher, select completion/payment outcome, and record the amounts. Cash, partial cash/credit, credit-only, cheque, mixed settlement, no payment and older-bill collection are supported. Unneeded amount fields are hidden and disabled. Mixed settlement creates one delivery with separate payment components. Older-bill collection creates a collection without a duplicate delivery or new credit.
- Amounts use integer fils. Cash, credit and cheque totals are separate. Old-bill cash is a labelled subset of cash received. Cheques remain received instruments, never cleared cash. Credit is an amount explicitly recorded by staff, not a calculated outstanding invoice balance.
- Managers review daily/staff totals, delivery history, collection history and the familiar Daily Collection Slip with separate cash/credit and cheque tables. Excel contains all rows, numeric amounts, purpose/notes and totals. Print / Save as PDF uses bundled Noto fonts and the paper's column labels.
- Each delivery and collection has its own ID, performer, shop snapshot/reference, invoice/voucher, timestamps and notes. The local audit records creation. Completed records have no silent editing or deletion control. The invoice alone is not a unique payment key; legitimate payments can share it.
- Financial retry keys are retained permanently in the demo state. Reusing the same key/body returns the original result without a new write; changed payloads with that key fail. A single storage write commits delivery, payment components, audit and retry record together. Storage failures preserve the prior state and form for retry.

## Approved reference fixture

The **Reference slip** button selects fictional date `2026-10-17`. The thirteen collections use synthetic staff/shop names and `DEMO-INV` / `DEMO-RV` references. The original photographed slip, staff/customer names and actual reference numbers are not published.

| Rows | Approved AED amounts | Computed total |
| --- | --- | --- |
| Cash 1–8 | 298, 135, 82, 76, 278, 300, 336, 105 | 1,610.00 |
| Credit 9–13 | 447, 307, 1,465, 227, 116 | 2,562.00 |
| Cheques | No entries | 0.00 |

These are reference collections with no inferred full/partial settlement, invoice balance, older-bill classification or delivery completion. Other payment scenarios are created separately by the synthetic automated/browser tests.

## Persistence and permissions

The existing `emerald-client-demo-v1` key remains in use. An additive, tested version 1 → 2 upgrade preserves saved shops, visits, discussions, follow-ups, duty sessions, breaks, profile selection, audit and replay keys. It adds deliveries, collections and permanent financial-operation retries. A failed upgrade write does not erase the old data. Reset restores all original shops and the new reference fixture.

Delivery staff record/read their own finance records and duty sessions; sales executives retain their visit/follow-up operations; managers review all staff and collections. These are demo-role rules, not secure authentication. Browser-local data is editable and is not an accounting ledger.

Records are shared when switching roles within the same browser/origin. Other devices, browsers, incognito contexts and Preview URLs have separate copies. The new Preview does not automatically copy data from the previous Preview URL. Device-clock timestamps use UAE business-date reporting.

## Verification and evidence

Local verification passed: **99 regular tests**, **16 delivery/collection browser checkpoints** and **31 existing workflow regression checkpoints**. Both the normal build and static client build passed. Browser checks covered 390, 430, 768, 1024 and 1440px, storage-write failure/retry, refresh, role switching, additive saved-data migration, visits, notes, follow-ups and unchanged duty/break/hour calculations. Eight Excel workbooks and eight browser-generated PDFs were downloaded across the two suites. The two new collection workbooks were reopened and checked; both new slip PDFs were rendered and visually inspected, including Arabic and Malayalam names and embedded Noto fonts. The reference is one portrait page with exact 13 rows and approved totals. No API/external requests, failed assets or browser errors were observed. Evidence: `development/evidence/delivery-collections/local/` and `regression/`. Publication verification follows below. The dedicated harness is `development/scripts/collections-browser.ts`; the existing `attendance-browser.ts` provides the broader visits/follow-ups/attendance regression. Regular tests include `collections.test.ts` for money, atomic writes, permanent retries, role boundaries, migration, exact reference totals, exports and confirmed-sales separation.

Physical Android/iPhone, native print/keyboard behavior and human first-time-user feedback remain pending. Chromium viewport/touch emulation is not physical-device evidence. No hosted database integration is claimed.

Repeat locally with Node 22 and pinned pnpm: build `client-demo`, run `pnpm test` from `development`, then `node --import tsx scripts/collections-browser.ts` and `node --import tsx scripts/attendance-browser.ts`. Set `DEMO_EVIDENCE_DIR` to a new evidence directory; set `DEMO_BASE_URL` only to an explicitly approved static Preview for hosted checks.

## Owner walkthrough

1. Choose Delivery Person · Samir Demo. Start duty independently from delivery work.
2. Open Record Delivery. Search a fictional shop, choose it, enter a fictional existing invoice/voucher and cash amount, then save. Confirm the visible saved message.
3. Try a separate partial payment, cheque or mixed settlement. For an older invoice, choose Older bill collection only. Cheques must have number/date/amount and remain separate from cash.
4. Review Today's Collections, refresh, take/return from a break and end duty. Delivery completion never ends duty.
5. Switch to Manager in the same browser. Open Collections, choose Samir and a date, review the histories and download Excel or Print / Save as PDF.
6. Choose Reference slip and verify 1,610 cash / 2,562 credit / 0 cheques. Return to Today for new test records.
7. Choose Ahmed to record an optional confirmed order value during a visit. In Manager Overview, filter the executive/date and check that confirmed sales and collections remain separate.

## Client decisions and real-backend work still required

| Topic | Demo behavior / pending approval |
| --- | --- |
| Historical corrections, cancellation, voids and reversals | Records retained; no edit/void workflow invented. Approve authorized manager process, reasons and original-value audit first. |
| Cheque clearing, bounce, deposit and bank reconciliation | Receipt only; no clearing or cash conversion. Approve the later lifecycle before implementation. |
| Invoice balances, repeated invoices and voucher validation | Existing references entered manually. No Zoho lookup, balance inference or invoice-number uniqueness rule. Client must confirm reconciliation and duplicate-warning policies. |
| Incomplete deliveries and later attempts | Each explicitly recorded event is retained. Confirm how real dispatches/attempts should be linked before production. |
| Confirmed order values across repeat visits | Manual values recorded at visit checkout, not unique formal Zoho orders or accounting revenue. Confirm any cross-visit order-reference/deduplication policy later. |
| Real role and persistence | Requires separately approved delivery role/membership, server authorization, database transactions/constraints, durable idempotency, audit/reversal design, backups/restore and hosted acceptance. None is enabled by the demo selector. |

No Supabase, hosted PostgreSQL, payment gateway, real employee/customer account, real-data import or Zoho integration was created or connected. No payroll/overtime rules, product catalogue, item-wise order entry, formal quotation, invoice or e-commerce feature was added.

## Publication and approval checkpoint

Owner-review Preview: **https://emerald-sales-client-demo-p3d1secrl-faziils-projects.vercel.app/**

- Deployed source commit: `7fa11096ab23811641845d0d5f4157fcdce440bb` on `demo/delivery-collections`.
- Deployment: `dpl_4hUFx1uCdU7MqzsG9m83gtnWd9fh`, project `emerald-sales-client-demo`, READY, target `null` (Preview). Root `client-demo`, Node 22.x, output `dist`. No functions/backend bundle; no new services or secrets. Deployment automation remains disabled.
- HTTPS acceptance passed **16 delivery/collection + 31 regression checkpoints**. Eight Excel and eight PDF downloads were exercised and checked. New slip PDFs have embedded fonts and were rendered and visually reviewed. All five required viewport widths passed. The 14 hosted static artifacts compare to the verified local build after Git line-ending and generated chunk-name normalization; their hashes and security headers are recorded in `https-artifacts.json`.
- The original `development` project/deployment, its production domains and protection are unchanged. Remote `main` remains `9296cf36c94173e418abf1e57a367bdb48c3ff8c`; staging remains `825db7a09a07e9053b1f48a898ad2e6b5cb60332`; accepted attendance remains `f053278a482b59f7673221d8935a0de8ace60730`.
- Gitleaks scanned all 34 source-history commits with no leaks. The complementary audit scanned 1,028 blobs, extracted 88 PDFs / 104 workbooks across history, compared 10 private local passwords, and found no prohibited files or real credentials after reviewing six synthetic test matches. No original slip photograph or private local files are published.
- A following documentation/evidence-only commit records the completed hosted checks; it does not alter the deployed application. Use `git log -1` for that handoff commit.

Evidence: `development/evidence/delivery-collections/https/` and `https-regression/`; deployment details/build log in `publication.json`. Screenshots: `https/owner-delivery-mobile.png`, `https/owner-delivery-form-full.png`, `https/owner-manager-collections.png`. Reference examples: `https/daily-reference.xlsx` and `https/daily-reference.pdf`.

**Stop here for owner approval before client sharing.** No client acceptance is claimed. Physical Android/iPhone and native Print / Save as PDF checks still need a human. Browser-local role selection is demonstration behavior and must not be used for real financial data. The correction, cheque-clearing and reconciliation policies above remain pending. Existing saved records are retained when upgrading this same origin; a new Preview origin starts its own independent sample copy.
