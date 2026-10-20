# Manager reporting contract

Agent 3 owns `src/reports.ts`, `client/manager.ts` and `tests/reports.test.ts`. No shared entrypoint, runtime environment, database migration, package dependency or existing stylesheet was changed in this worktree.

## Server integration

Instantiate `new Reports(db)` and dispatch authenticated GETs with the existing actor and `url.searchParams`:

- `/api/reports/activity` → `.activity(actor, params)`
- `/api/reports/duty` → `.duty(actor, params)`
- `/api/reports/followups` → `.followups(actor, params)`
- `/api/reports/:kind/export?format=xlsx|pdf` → `.exportRows(actor, kind, params)`, then serialize through the coordinator's actual Excel/PDF downloader. Validate `format` in that route before generating files.

All calls recheck an active same-organization manager/admin membership inside a repeatable-read, read-only transaction. Executives cannot use the report service or exports. A person filter must refer to an executive membership in the actor's organization; inactive executives remain reportable. Authentication, Origin/session handling and response headers remain the server entrypoint's responsibility.

Filters: `from`, `to` are valid inclusive UAE business dates, defaulting to today. A range longer than 366 elapsed days rejects with 422 rather than consuming unbounded resources. `person` is an optional executive UUID; `page` defaults to zero; `pageSize` defaults to 40 and permits 1–100. Report rows have deterministic ordering. Every response includes `{from,to,person,timeZone:'Asia/Dubai',asOf,page,pageSize,total,rows}`. Invalid schemas throw Zod errors through the existing error handler.

Activity rows are visits **checked in** within the range, with original visit fields, `shop_name`, `area`, `visitor_name`. `staff` has one current executive membership per row: `id,name,active,checked_in,completed_visits,open_visits,pending_followups,due_followups,recorded_sessions,duty_status`. `summary` totals those fields and includes `executives,on_duty,on_break`. Completed visits count **checkout** timestamps inside the range, including overnight visits started earlier; this is labelled in the UI. Current open visits, pending follow-ups and duty state describe the saved current state, not historical state inferred at a selected date. Pending totals count lifecycle records, not unique shops.

Duty rows include overlapping `duty_sessions`, `executive_name`, original `rests[]`, current session `state`, `clipped_from`, `clipped_to`, `elapsed_minutes`, `rest_minutes`, `active_minutes`. Session/rest timestamps remain exact originals. Duration totals clip to the selected range and report time for ongoing sessions. Overlapping rest intervals are defensively unioned before summation. Minutes are rounded to two decimal places. The UI labels elapsed time **Recorded duty** and **Recorded rest**. It does not label staff absent/late or infer paid hours, approved shifts or attendance penalties. Current duty state is kept separate from historical recorded sessions.

Follow-up rows include lifecycle fields, `due_date` as YYYY-MM-DD, `shop_name`, `area`, `owner_name`. `status=pending|completed|cancelled|all` defaults to pending. `scope=range` filters due dates inclusively; `scope=outstanding` explicitly means all pending items due on/before `to`, including overdue before `from`, and overrides status to pending. UI defaults to outstanding and explains this. Response metadata returns effective `status` and `scope`. Changing to a nonpending status changes scope to range. Ownership/status represent current saved records; no fabricated historical snapshot.

## Export DTO

`exportRows` returns `{kind,title,from,to,person,timeZone,asOf,total,notes:string[],columns:{key,label}[],rows:Record<string,any>[]}`. Every matching record is read in one snapshot, ignoring page/pageSize. More than 10,000 records produces explicit `422 EXPORT_TOO_LARGE`; no successful report silently truncates. `rows.length === total`. Timestamp values in the export DTO are formatted in UAE time as en-GB date/time; due dates remain YYYY-MM-DD; numeric minutes remain numeric. Duty DTO adds `rest_history`, containing every recorded break/return and `Ongoing` where applicable. Column definitions are user-facing and intentionally concise; full visit discussions remain in the application history. `notes` explains date semantics and follow-up scope, and should be printed in exports. The serializer must write cell values as text/numbers, never spreadsheet formulas; coordinator owns that boundary.

## Client integration

`createManagerView({container,request,download,openShop,today,team?})` returns `{load():Promise<void>,dispose():void}`. `today` is required and should be the server's UAE business date. Team entries have `{id,name,role?}`; passing all metadata members is safe because nonexecutives are filtered. With team omitted, the activity response supplies the list.

`request(path)` receives a path **without** `/api`, e.g. `/reports/activity?from=...`; reuse the session-aware API reader. `download(path)` receives `/reports/:kind/export?...&format=xlsx|pdf`; fetch with the current session, check the response status before saving, then create and release a Blob URL/native download. Report service auth applies equally to these reads. `openShop(id)` navigates to the existing shared profile.

Call `load()` after mounting. Call `dispose()` whenever the application leaves/replaces this view, logs out or creates another controller. Listeners are container-scoped and manager-specific data attributes do not overlap ordinary executive shop/filter attributes. Obsolete requests cannot render after disposal or a newer load. Failed loads clear old data, show an understandable error with Retry, and preserve chosen filters. Filters do not silently show stale rows under a changed heading.

The default screen uses the existing Emerald panel/card/table/button/form classes: today's date/person filters, four plain counts, readable staff attendance/activity rows, then Visits / Duty and breaks / Follow-ups. Downloads are visible beside the selected report. No charts or administration settings were added. Mobile tables use existing `mobile-cards` responsive behavior.

## Agent verification

Executed strict TypeScript (`tsc --noEmit -p development/tsconfig.json`) and `tsx --test development/tests/reports.test.ts` against isolated in-memory PostgreSQL. **8 reported tests passed, zero failed** (7 scenario groups plus the parent). Coverage: manager/admin role and active-account recheck; executive export/read denial; organization/person isolation; UAE inclusive/exclusive dates; separate overnight checkout totals; paginated row totals; date/range/page validation; repeated and ongoing breaks; exact clipped durations; pending/completed/cancelled due scopes; complete exports beyond one page; 10,000-record cap failure without truncation.

Integrated browser acceptance, actual XLSX/PDF file generation and visual screenshots belong to coordinator/independent QA and are not claimed by this unit-level handoff. No migration was required. No deployment or production identity/data work occurred.
