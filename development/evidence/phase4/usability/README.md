# Focused usability review evidence

20 October 2026, final run 14:34 UAE. Reviewed local app `http://127.0.0.1:3100/` from base commit `0b9ad20e554f1a89d9e94918588da44728df9ce1`. Read Phase 3 handoff, demonstration and acceptance documents plus `client/app.ts`, `client/manager.ts` and `client/style.css`. No application source changes or commits were made by this reviewer.

## Executed scope

[inspection.json](inspection.json) records **10 fresh browser contexts**: executive and manager, each at **390, 430, 768, 1024 and 1440 CSS pixels**. Edge Chromium ran headlessly against the actual local HTTP application. Each context signed in and out independently. All five destinations were opened; shop search, shared shop history and the follow-up jump were exercised. Executive **Complete follow-up** dialogs were opened and dismissed without saving. Manager follow-up scope and duty report controls were inspected. Home/shop layout checks found no document-level horizontal overflow. No uncaught page errors occurred.

The request guard in [inspect.mjs](inspect.mjs) allowed only GET/HEAD plus login/logout POSTs. `blockedWrites` is empty: **no operational writes were attempted**. Current duty labels were visible for both roles at each width; this reviewer did not change duty status or test a live transition. Full visit/follow-up completion, state transitions and report downloads belong to the coordinator's separate journey evidence. The initial harness attempt used an over-exact label for a select inside a wrapping label and timed out; the final run uses its stable data attribute and completed successfully.

## Assessment

No observed issue prevented this focused local navigation demonstration. These are engineering observations, not evidence that a novice human has accepted the interface:

- **Executive navigation is direct:** Today opens the separate duty card and a prominent Search shops action; the five labelled destinations remain visible. The shop's Follow-ups link lands above the long visit history on mobile. Complete opens a short note-and-save dialog.
- **Manager visibility is understandable from the labels:** Daily activity puts date/staff controls, explained totals and Staff activity before detailed reports. Duty now is explicitly current; the page states to use Show activity to refresh. It is a snapshot rather than a live feed.
- **Emerald identity is retained:** login and tablet/desktop show the supplied logo/name; established green, white panels, table/card structure and navigation continue. The previously documented low-priority gap remains: signed-in mobile hides the sidebar/brand and does not show an Emerald name/logo. Client recognition still needs a human decision.
- **Retained desktop tradeoff:** the executive Today table sits beside due follow-ups at 1440px and uses internal horizontal scrolling for its far-right columns. The document itself fits. Human UAT should confirm that the visit status is discoverable.
- **Repeated follow-up ambiguity to observe:** separate items can have the same shop, owner, due date and linked visit date; the card does not show the linked visit time. These items remain independent. The presenter should identify the intended item before completing it, and human UAT should record any difficulty. No redesign was performed.

## Representative screenshots

All 51 PNGs are synthetic-data captures from the final run. Full-page captures contain fixed/sticky navigation at the scroll position; the `*-viewport-*` captures show the actual visible shop/dialog viewport. Reviewed home screenshots for both roles at all five widths, and representative shop and completion-dialog captures.

| View | Evidence |
|---|---|
| Login identity | [390px](login-390.png) |
| Executive Today | [390px](ahmed-home-390.png), [430px](ahmed-home-430.png), [768px](ahmed-home-768.png), [1024px](ahmed-home-1024.png), [1440px](ahmed-home-1440.png) |
| Manager Overview | [390px](manager-home-390.png), [430px](manager-home-430.png), [768px](manager-home-768.png), [1024px](manager-home-1024.png), [1440px](manager-home-1440.png) |
| Executive completion dialog, unsaved | [390px viewport](executive-complete-followup-dialog-viewport-390.png), [1440px viewport](executive-complete-followup-dialog-viewport-1440.png) |
| Manager shared follow-ups | [390px viewport](manager-shop-viewport-390.png) |
| Manager follow-up/duty reports | [Follow-ups 390px](manager-followups-390.png), [Duty 1440px](manager-duty-1440.png) |

## Acceptance boundary

No first-time person or physical phone was tested. Viewport checks do not establish real touch, keyboard, GPS permission/accuracy, mobile download/open behavior or client language acceptance. All human result fields remain unticked in [PHASE4-PHONE-UAT.md](../../../docs/PHASE4-PHONE-UAT.md). That checklist includes the loopback/staging access prerequisite. Production authorization remains absent.
