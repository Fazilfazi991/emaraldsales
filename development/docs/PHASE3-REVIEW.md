# Independent owner/usability review

Method: two independent reviewers, with design findings withheld from the evidence reviewer until both initial assessments finished. Base `31402a8`; review date 20 October 2026. Coordinator owns integration. No operational database changes were made by reviewers.

## Findings and disposition

| Priority | Observed problem | Candidate improvement |
|---|---|---|
| P1 | Changing an ordinary search filter closed its disclosure; the active condition could disappear from view | Preserve disclosure state, show active count, offer Clear filters for search/filters |
| P2 | Manager mobile first screen contained controls before any result | Put totals/staff before detailed reports, share one date row, add direct report jump link |
| P2 | Date-bound completed visits and current pending work looked comparable | Label time scopes at the values and in reports; preserve calculations |
| P2 | Dashboard/Leads vocabulary required interpretation | Today/Overview by role, New shops, Team; routes and permissions retained |
| P2 | PDF rejected Arabic/Malayalam; export metadata omitted staff and generation time | Licensed bundled Noto, embedded font subsets, Chromium shaping/bidi, visible scope/context/totals and repeated page context |
| P2 | Fixed Excel row heights clipped repeated break history | One interval per row in Break history; dynamic row heights including long names |
| P2 | Export counts omitted checkout totals and could not explain overnight differences | Export same-snapshot summary and distinguish started/completed totals |
| P3 | Mobile signed-in header has no logo/name | Existing recognizable green UI and branded login preserved; no extra header clutter introduced. Owner may request a compact brand treatment after phone UAT |

The initial design assessment scored Nielsen heuristics 26/40: status3, real-world match3, control2, consistency3, error prevention3, recognition2, efficiency2, minimalism3, recovery3, help2. This is the baseline reviewer's judgment, not a validated post-change score. Executive home already provided a clear Search shops/Open visit primary action; separate duty controls, short checkout forms and safe retry were strengths. Manager mobile control density and hidden filter scope were the main novice-user obstacles.

Persona assessment: first-time field executives need visible scope and predictable next actions; busy managers need today's answers before report configuration; less confident mobile users benefit from plain labels and retained touch sizes. Five destinations remain, but daily primary actions lead the user. No new module, chart or configuration screen was added.

## Verification provenance

- Baseline automated suite reproduced: 52/52. Baseline browser reproduction: 16 grouped checkpoints, 43 layout captures, 15 downloads. Source commit recorded in before/browser.json is the accepted `31402a8`.
- Independent evidence reviewer reconciled original Phase 2 counts, role checks and download scope. Populated duty exports were a real evidence gap; Phase 3 exercises them explicitly.
- Initial and post-change mechanical detector results: zero findings. These are heuristic scans, not proof of usability or accessibility.
- Native browser inspection timed out for the design reviewer; fresh local Playwright browser sessions supplied live read-only evidence. No overlay is claimed. Sessions revoked; temporary reviewer screenshots removed; existing server retained.
- Independent report review checked font hashes/license, rendered scripts, 75 unique records, empty selected-staff export and an oversized 300-break record. Findings about repeated context, first-page row flow, long-name Excel rows and sample totals/timezone were incorporated.
- Scripted label-based journeys are not independent first-time human research. Actual-device keyboard/GPS/download acceptance and client language review remain pending.

Questions skipped: the owner already requested local implementation and a concrete acceptance handoff; policy choices remain on the client checklist rather than blocking authorized local fixes.

## Before/after evidence

Review matching states side by side; synthetic names differ in the Phase 3 Unicode fixture.

| Surface | Accepted candidate before | Phase 3 after |
|---|---|---|
| Manager mobile | [Before](../evidence/phase3/before/manager-overview-390.png) | [After](../evidence/phase3/after/manager-overview-390.png) |
| Manager desktop | [Before](../evidence/phase3/before/manager-overview-1440.png) | [After](../evidence/phase3/after/manager-overview-1440.png) |
| Shop search/profile mobile | [Before](../evidence/phase3/before/executive-shop-390.png) | [After](../evidence/phase3/after/executive-shop-390.png) |
| Visible active filter | Original behavior described above | [After](../evidence/phase3/after/executive-active-filter-390.png) |

Client-facing clean demonstration screenshots are under `evidence/phase3/demo`; regression screenshots may deliberately include untrusted-text probes and error states.
