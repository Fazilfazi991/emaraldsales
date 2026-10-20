# Phase 4 local demonstration

20 October 2026. Synthetic local review only; owner/client acceptance and production authorization remain pending. This is a presenter checklist, not a record of executed human acceptance. Use `http://127.0.0.1:3100/` on the host computer. Use separate fresh browser profiles for the executive and manager. Private random passwords remain in `development/.local/phase3-demo-accounts.json`; do not copy that file into evidence or presentation material.

For live attendance, keep both roles open: show the manager's On duty after executive Start duty, and refresh after break/return/end. The two role checklists can be interleaved; an extra duty session is not needed just to demonstrate a status.

## Executive: complete a working day and a follow-up

- [ ] Sign in as Ahmed. Identify **Today**, **Your working day**, and the duty status. Explain that duty timing and shop visits are separate.
- [ ] **Start duty**, then **Search shops**. Search for **Al Noor**, open the shop, read earlier visits and the assigned executive. Use **Clear filters** when a filter hides the expected result.
- [ ] **Check in to this shop**. Observe the location result honestly; denied/unavailable location must not be presented as a verified GPS position.
- [ ] **Complete visit · Check out**. Enter **What did you discuss?**, choose the outcome, and save with **Check Out · Save Visit**. Observe the saved confirmation and history entry.
- [ ] Create one intended follow-up, using either the checkout date field or **Add follow-up**. Read its due date, owner and linked visit. Avoid adding a second item for the same intended task.
- [ ] Use the shop's **Follow-ups ↓** link. Identify that intended pending item, press **Complete**, review/edit **Completion note**, then **Save follow-up**. Confirm that the item is completed; refresh and sign out/in to confirm it remains completed. Other pending items may remain.
- [ ] Return to **Today**; **Start break**, **Return to duty**, then **End duty**. Confirm the saved state after each action.

For an unconfirmed save, retain the form, reconnect and use **Retry save**. The current form retains its operation key; offline recovery after closing or reloading the form is not offered.

## Manager: current duty and saved activity

- [ ] Sign in as Manager. Identify **Overview / Daily activity**, selected UAE dates and the four totals. Distinguish **Pending follow-ups now** from totals limited to selected dates.
- [ ] In **Staff activity**, locate Ahmed and read **Duty now**. Have the executive start duty, then press **Show activity** and confirm the current status; repeat after break/return/end when presenting those states. This is a saved snapshot refreshed by **Show activity**, not a live attendance feed.
- [ ] Select Ahmed under **Sales executive** or press his staff name. Press **Show activity**. Identify the visit recorded above and its actual executive.
- [ ] Use **Reports and downloads ↓**, then **Follow-ups**. Explain **Through end date, including overdue** versus **Selected dates only**. Open the shop's shared history and verify the completed follow-up; choose **Completed** when checking it in the report.
- [ ] Return to **Overview** and select the intended dates/executive. Download **Visits**, **Duty and breaks**, and **Follow-ups** as Excel/PDF. Read dates, staff, generation time and totals; inspect Excel's **Break history** sheet.
- [ ] Refresh, then sign out/in. Confirm saved records persist. Fresh-login filters reset to today/all staff.

## Presenter sign-off

Presenter: __________  Date/time (UAE): __________  Build/commit: __________

Executive demonstration result/evidence: __________________________________

Manager demonstration result/evidence: ____________________________________

First-time human and real-phone results must be recorded separately in [PHASE4-PHONE-UAT.md](PHASE4-PHONE-UAT.md). Automated browser review at 390/430/768/1024/1440px is evidence of emulated layout only. Arabic/Malayalam spelling, reading order and business terminology still need client approval.
