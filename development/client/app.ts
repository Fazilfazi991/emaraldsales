import {
  addDays,
  businessDay,
  outcomes,
  orderStates,
  shopStatuses,
  type Actor,
} from "../src/domain.js";
import { createManagerView } from "./manager.js";
type Row = Record<string, any>;
type List = { rows: Row[]; total: number; page: number; pageSize: number };
type Profile = { shop: Row; visits: Row[]; followups: Row[] };
type Filter = {
  q: string;
  person: string;
  area: string;
  status: string;
  when: string;
  page: number;
};
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const h = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const button = (text: string, attr: string, primary = false) =>
  `<button type="button" class="button${primary ? " primary" : ""}" ${attr}>${text}</button>`;
const nav = [
  ["dashboard", "▦", "Dashboard"],
  ["shops", "⌂", "Shops"],
  ["visits", "◷", "Visits"],
  ["leads", "＋", "New shops"],
  ["team", "♙", "Team"],
];
let me: {
    actor: Actor;
    csrf: string;
    policies: { visit: string; duty: string };
  },
  meta: { team: Row[]; areas: string[] };
let view = "dashboard",
  selected: string | null = null,
  profile: Profile | null = null,
  dashboard: Row,
  duty: { sessions: Row[]; rests: Row[] } = { sessions: [], rests: [] };
let list: List = { rows: [], total: 0, page: 0, pageSize: 40 },
  filters: Filter = {
    q: "",
    person: "",
    area: "",
    status: "",
    when: "",
    page: 0,
  };
let formAction = "",
  formId = "",
  epoch = 0,
  submitting = false,
  serverDay = "",
  fetching = false;
const retryKeys = new Map<string, string>();
const checkinPayloads = new Map<string, unknown>();
let unconfirmed: { path: string; signature: string } | null = null;
let managerView: ReturnType<typeof createManagerView> | undefined;
let filtersOpen = false;
let retryOperation: { work: () => Promise<unknown>; message: string } | null = null;
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function api(
  path: string,
  body?: unknown,
  mutation = false,
): Promise<any> {
  const signature = JSON.stringify([path, body]);
  if (mutation && unconfirmed && unconfirmed.signature !== signature)
    throw new ApiError(409, "A previous save is unconfirmed. Use Retry save before starting another action.");
  let key = retryKeys.get(signature);
  if (mutation && !key) {
    key = crypto.randomUUID();
    retryKeys.set(signature, key);
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers: {
        ...(body !== undefined
          ? {
              "Content-Type": "application/json",
              "X-CSRF-Token": me?.csrf ?? "",
            }
          : {}),
        ...(mutation ? { "Idempotency-Key": key! } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    if (mutation) unconfirmed = { path, signature };
    throw new ApiError(
      0,
      mutation ? "Connection lost. Save is unconfirmed. Reconnect and use Retry save." : "Unable to load this information. Check your connection and try again.",
    );
  }
  let data: any;
  try { data = await response.json(); }
  catch {
    if (mutation) unconfirmed = { path, signature };
    throw new ApiError(0, mutation ? "Save is unconfirmed. Use Retry save when the connection returns." : "Unable to read the server response. Refresh to try again.");
  }
  if (!response.ok) {
    if (mutation) unconfirmed = response.status >= 500 ? { path, signature } : null;
    if (response.status === 401 && path !== "/login")
      loginScreen(
        "Your session expired. Sign in, then check the shop history before retrying.",
      );
    throw new ApiError(
      response.status,
      data.error?.message ?? "The server could not confirm the action.",
    );
  }
  if (mutation) { retryKeys.delete(signature); unconfirmed = null; }
  return data;
}
function toast(message: string) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  $("toasts").append(node);
  setTimeout(() => node.remove(), 5000);
}
function showError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unable to confirm the action.";
  const node = $("saveError");
  if (node) {
    node.textContent = message;
    node.hidden = false;
  } else toast(message);
}
const date = (s: unknown) =>
  s
    ? new Intl.DateTimeFormat("en-AE", {
        timeZone: "Asia/Dubai",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(
        new Date(String(s).length === 10 ? `${s}T12:00:00+04:00` : String(s)),
      )
    : "—";
const time = (s: unknown) =>
  s
    ? new Intl.DateTimeFormat("en-AE", {
        timeZone: "Asia/Dubai",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(String(s)))
    : "—";
const person = (id: string) =>
  meta.team.find((p) => p.id === id)?.name ?? "Unavailable account";
const avatar = (id: string) =>
  `<span class="avatar" aria-hidden="true">${h(
    person(id)
      .split(" ")
      .map((p: string) => p[0])
      .slice(0, 2)
      .join(""),
  )}</span>`;
const personCell = (id: string) =>
  `<span class="person">${avatar(id)}<span>${h(person(id))}</span></span>`;
const badge = (text: unknown) =>
  `<span class="badge ${/not interested|overdue|cancelled/i.test(String(text)) ? "red" : /open|currently|pending|follow|rest|expected/i.test(String(text)) ? "amber" : "green"}">${h(text)}</span>`;
const panel = (title: string, caption: string, body: string, id = "") =>
  `<section class="panel"${id ? ` id="${h(id)}" tabindex="-1"` : ""}><div class="panel-head"><div><h2 class="panel-title">${title}</h2><p class="panel-caption">${caption}</p></div></div>${body}</section>`;
const heading = (
  kicker: string,
  title: string,
  subtitle: string,
  actions = "",
) =>
  `<div class="heading"><div><p class="eyebrow">${kicker}</p><h1>${h(title)}</h1><p class="subheading">${subtitle}</p></div><div class="actions">${actions}</div></div>`;
const shopLink = (id: string, name: unknown) =>
  `<button type="button" class="shop-link cell-title" data-shop="${h(id)}">${h(name)}</button>`;
const duration = (v: Row) =>
  v.checked_out_at
    ? `${Math.max(0, Math.round((+new Date(v.checked_out_at) - +new Date(v.checked_in_at)) / 60000))} min`
    : "In progress";
const fact = (label: string, value: unknown) =>
  `<div class="fact"><label>${label}</label><strong>${h(value ?? "—")}</strong></div>`;
const visitEnabled = () => me.policies.visit === "approved-v2";
const executive = () => me.actor.role === "executive";
const supervisor = () => me.actor.role === "manager" || me.actor.role === "admin";
function shell() {
  $("application").innerHTML =
    `<div class="shell"><aside class="sidebar" aria-label="Main navigation"><div class="brand"><img class="brand-thumb" src="/brand.png" alt="Emerald Interlink"><div><b>EMERALD INTERLINK</b><span>Field Sales CRM</span></div></div><div class="workspace-label">FIELD WORKSPACE</div><nav class="nav" id="desktopNav"></nav><div class="sidebar-foot"><b>EMERALD INTERLINK TRADING L.L.C</b><br>Dubai, United Arab Emirates<div class="connection"><span class="dot"></span>Local review · synthetic data</div><div>Online saves · UAE reporting time</div></div></aside><main class="main"><header class="topbar"><div class="crumb">Emerald Interlink / <b id="crumb">Dashboard</b></div><div class="top-actions"><span class="signed-in">${h(me.actor.name)} <small>${h(me.actor.role)}</small></span>${button("Duty", "data-duty")}${button("Sign out", "data-logout")}</div></header><div class="content" id="content" tabindex="-1"></div></main><nav class="mobile-nav" id="mobileNav" aria-label="Mobile navigation"></nav></div>`;
}
function loginScreen(message = "") {
  managerView?.dispose();
  managerView = undefined;
  $("dialog").hasAttribute("open") &&
    ($("dialog") as HTMLDialogElement).close();
  $("application").innerHTML =
    `<main class="login-wrap"><section class="panel login-card"><img class="login-logo" src="/brand.png" alt="Emerald Interlink"><div class="panel-body"><p class="eyebrow">Field Sales CRM</p><h1>Sign in to your workspace</h1><p class="subheading">Shared shop history. Attributable field visits.</p><form id="loginForm"><label for="email">Email</label><input class="input" id="email" type="email" autocomplete="username" required><label for="password">Password</label><input class="input" id="password" type="password" autocomplete="current-password" required><p class="error" id="loginError" role="alert">${h(message)}</p><button class="button primary" type="submit">Sign in</button></form><p class="help">Local review workspace · synthetic records. Your administrator provisions accounts.</p></div></section></main>`;
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = $("loginForm").querySelector("button")!;
    submit.disabled = true;
    try {
      await api("/login", {
        email: ($("email") as HTMLInputElement).value,
        password: ($("password") as HTMLInputElement).value,
      });
      resetWorkspace();
      await bootstrap();
    } catch (error) {
      $("loginError").textContent =
        error instanceof Error ? error.message : "Sign-in failed.";
    } finally {
      submit.disabled = false;
    }
  });
}
function resetWorkspace() {
  managerView?.dispose();
  managerView = undefined;
  retryKeys.clear();
  checkinPayloads.clear();
  unconfirmed = null;
  retryOperation = null;
  dashboard = undefined as any;
  profile = null;
  selected = null;
  view = "dashboard";
  duty = { sessions: [], rests: [] };
  filters = { q: "", person: "", area: "", status: "", when: "", page: 0 };
  epoch++;
}
async function bootstrap() {
  me = await api("/me");
  meta = await api("/metadata");
  shell();
  await render();
}
function table(headers: string[], rows: string) {
  return `<div class="table-wrap mobile-cards"><table><thead><tr>${headers.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="empty">No records match this view.</td></tr>`}</tbody></table></div>`;
}
const cell = (label: string, body: string) =>
  `<td data-label="${label}">${body}</td>`;
function visitRows(rows: Row[]) {
  return table(
    [
      "DATE",
      "SALES EXECUTIVE",
      "SHOP / AREA",
      "CHECK IN",
      "CHECK OUT",
      "DURATION",
      "VISIT STATUS",
    ],
    rows
      .map(
        (v) =>
          `<tr>${cell("DATE", date(v.checked_in_at))}${cell("SALES EXECUTIVE", personCell(v.visitor_id))}${cell("SHOP / AREA", shopLink(v.shop_id, v.shop_name) + `<span class="cell-sub">${h(v.area)}</span>`)}${cell("CHECK IN", time(v.checked_in_at))}${cell("CHECK OUT", time(v.checked_out_at))}${cell("DURATION", duration(v))}${cell("VISIT STATUS", badge(v.outcome ?? "Currently Visiting"))}</tr>`,
      )
      .join(""),
  );
}
function teamCards() {
  return dashboard.team
    .map(
      (m: Row) =>
        `<button type="button" class="team-card history-card" data-person="${h(m.id)}"><div class="team-top">${avatar(m.id)}<span><strong>${h(m.name)}</strong><small>${m.completed} completed · ${m.active} active</small></span></div><div class="team-stats"><div class="team-stat"><b>${m.completed}</b><span>Completed today</span></div><div class="team-stat"><b>${m.week}</b><span>Last seven days</span></div><div class="team-stat"><b>${m.leads}</b><span>New leads</span></div></div><small>${m.pending} follow-ups pending · View history →</small></button>`,
    )
    .join("");
}
function renderDashboard() {
  if (executive()) return executiveDashboard();
  const m = dashboard.metrics,
    kpis = [
      ["Sales Executives", m.executives, "Field team"],
      [
        "Shop Visits Today",
        m.today,
        `${dashboard.active.length} open across all days`,
      ],
      ["Completed", m.completed, "Visits started today"],
      ["New Shops Added", m.new_shops, "New discoveries today"],
      ["Follow-ups Pending", m.pending, "Pending items, not unique shops"],
    ];
  const follows =
    dashboard.followups
      .map(
        (f: Row) =>
          `<div class="follow-row"><div class="left">${shopLink(f.shop_id, f.shop_name)}<span>${h(f.owner_name)} · ${date(f.due_date)}</span></div>${badge(f.due_date < m.day ? "Overdue" : f.due_date === m.day ? "Due today" : "Scheduled")}</div>`,
      )
      .join("") ||
    '<div class="empty">No follow-ups due in the next three days.</div>';
  const active =
    dashboard.active
      .map(
        (v: Row) =>
          `<div class="activity-row">${avatar(v.visitor_id)}<div class="activity-copy">${shopLink(v.shop_id, v.shop_name)}<p>${h(v.visitor_name)} · ${date(v.checked_in_at)} ${time(v.checked_in_at)}</p></div>${badge("Open")}</div>`,
      )
      .join("") || '<div class="empty">All field visits are checked out.</div>';
  return `${heading(executive() ? "Field workspace" : "Manager overview", "Today’s field activity", `${date(m.day)} · Asia/Dubai · refreshed ${time(m.server_time)}`, button("Refresh", "data-refresh") + button("View all visits →", 'data-view="visits"'))}${executive() ? dutyCard() : ""}<section class="kpis">${kpis.map(([label, value, foot], i) => `<article class="kpi"><div class="kpi-top"><span>${label}</span><span class="kpi-icon">${["♙", "⌖", "✓", "＋", "◷"][i]}</span></div><div class="kpi-value">${value}</div><div class="kpi-foot">${foot}</div></article>`).join("")}</section><div class="layout-main"><div class="stack">${panel("Today’s visits", `${m.today} recorded today`, visitRows(dashboard.today.rows))}${panel("Sales team progress", "Derived from recorded activity", `<div class="panel-body team-grid">${teamCards()}</div>`)}${panel("Currently in the field", "Open visits, including earlier days", `<div class="panel-body">${active}</div>`)}</div><aside class="stack">${panel("Follow-ups due", "Three days ahead, including overdue items", `<div class="panel-body">${follows}</div>`)}${panel("New shops this week", "Recent field discoveries", `<div class="panel-body">${dashboard.recent.map((s: Row) => `<div class="follow-row"><div>${shopLink(s.id, s.name)}<span>${h(s.area)} · ${date(s.created_at)}</span></div>${badge(s.status)}</div>`).join("") || '<div class="empty">No new shops this week.</div>'}</div>`)}<div class="notice">Every recorded visit stays in the shop’s shared history so the next executive can pick up where the last visit left off.</div></aside></div>`;
}
function executiveDashboard() {
  const active = dashboard.active.find((v: Row) => v.visitor_id === me.actor.id);
  const today = dashboard.today.rows.filter((v: Row) => v.visitor_id === me.actor.id);
  const due = dashboard.followups.filter((f: Row) => f.owner_id === me.actor.id);
  const follows = due.map((f: Row) => `<div class="follow-row"><div class="left">${shopLink(f.shop_id, f.shop_name)}<span>${date(f.due_date)}</span></div>${badge(f.due_date < serverDay ? "Overdue" : f.due_date === serverDay ? "Due today" : "Scheduled")}</div>`).join("");
  return `${heading("Field workspace", "Your working day", date(serverDay), button("Refresh", "data-refresh"))}${dutyCard()}${panel(active ? "Your visit in progress" : "Ready for your next visit?", active ? "Open the shop to finish and save your visit." : "Search for a shop, review its history, then check in.", `<div class="panel-body daily-next">${active ? `<div><strong>${h(active.shop_name)}</strong><p class="subheading">Checked in ${date(active.checked_in_at)} at ${time(active.checked_in_at)}</p></div>${button("Open visit · Check out", `data-shop="${h(active.shop_id)}"`, true)}` : button("Search shops", 'data-view="shops"', true)}</div>`)}<div class="layout-main section"><div class="stack">${panel("Your visits today", `${today.length} recorded · ${today.filter((v: Row) => v.checked_out_at).length} completed`, visitRows(today))}</div><aside>${panel("Your follow-ups due", "Overdue and next three days · Open a shop to update", `<div class="panel-body">${follows || '<p class="empty">No follow-ups due. Add an optional follow-up date when completing a visit.</p>'}</div>`)}</aside></div>`;
}
function options(values: [string, string][], selected: string) {
  return values
    .map(
      ([value, label]) =>
        `<option value="${h(value)}" ${selected === value ? "selected" : ""}>${h(label)}</option>`,
    )
    .join("");
}
function toolbar(visits = false) {
  const count = [filters.person, filters.area, filters.status, filters.when].filter(Boolean).length;
  return `<div class="toolbar"><label class="search"><span class="search-icon">⌕</span><input class="input" id="search" placeholder="${visits ? "Search shop, executive or notes…" : "Search shop, mobile, contact or area…"}" aria-label="${visits ? "Search visits" : "Search shops"}" value="${h(filters.q)}"></label><details class="filter-options" ${filtersOpen ? "open" : ""}><summary>${count ? `Filters · ${count} active` : "More filters"}</summary><div class="filter-fields"><select class="select" aria-label="Filter by sales executive" data-filter="person">${options([["", "All executives"], ...meta.team.filter((m) => m.role === "executive").map((m) => [m.id, m.name] as [string, string])], filters.person)}</select><select class="select" aria-label="Filter by area" data-filter="area">${options([["", "All areas"], ...meta.areas.map((a) => [a, a] as [string, string])], filters.area)}</select><select class="select" aria-label="Filter by status" data-filter="status">${options([["", "All statuses"], ...(visits ? [...outcomes, "Currently Visiting"] : shopStatuses).map((a) => [a, a] as [string, string])], filters.status)}</select><select class="select" aria-label="Filter by date or visit" data-filter="when">${options(
    visits
      ? [
          ["", "All dates"],
          ["today", "Today"],
          ["yesterday", "Yesterday"],
          ["week", "Last seven days"],
          ["month", "This month"],
        ]
      : [
          ["", "Visit / follow-up"],
          ["visited", "Visited"],
          ["never", "Never visited"],
          ["due", "Follow-up set"],
        ],
    filters.when,
  )}</select></div></details>${count || filters.q ? button("Clear filters", "data-clear-filters") : ""}<span class="results">${list.total} ${visits ? "visits" : view === "leads" ? "leads" : "shops"}</span></div>`;
}
function pages() {
  return `<div class="pagination">${button("← Previous", `data-page="${list.page - 1}" ${list.page === 0 ? "disabled" : ""}`)}<span>Page ${list.page + 1} of ${Math.max(1, Math.ceil(list.total / list.pageSize))}</span>${button("Next →", `data-page="${list.page + 1}" ${(list.page + 1) * list.pageSize >= list.total ? "disabled" : ""}`)}</div>`;
}
function renderShops() {
  return (
    heading(
      view === "leads"
        ? "New accounts from the field"
        : "Your customer directory",
      view === "leads" ? "New shops" : "Shops",
      "Search your shop network. Open a shop to review every past visit.",
      executive() ? button("＋ Add New Shop", "data-add", true) : "",
    ) +
    panel(
      view === "leads" ? "New shops" : "All shops",
      "Shared history across the field team",
      toolbar() +
        table(
          [
            "SHOP / CONTACT",
            "MOBILE",
            "AREA",
            "SALES EXECUTIVE",
            "STATUS",
            "LAST VISIT",
            "FOLLOW-UP",
            "TOTAL VISITS",
          ],
          list.rows
            .map(
              (s) =>
                `<tr>${cell("SHOP / CONTACT", `<div class="shop-record"><span class="shop-initial">${h(s.name[0])}</span><span>${shopLink(s.id, s.name)}<span class="cell-sub">${h(s.contact)}</span></span></div>`)}${cell("MOBILE", h(s.phone))}${cell("AREA", h(s.area))}${cell("SALES EXECUTIVE", personCell(s.assigned_executive_id))}${cell("STATUS", badge(s.status))}${cell("LAST VISIT", date(s.last_visit))}${cell("FOLLOW-UP", date(s.next_followup))}${cell("TOTAL VISITS", `${s.visit_count} visits →`)}</tr>`,
            )
            .join(""),
        ) +
        pages(),
    )
  );
}
function timeline(v: Row) {
  const availability = v.location?.availability ?? "not_requested";
  return `<article class="visit-record"><div class="visit-top"><strong>${date(v.checked_in_at)}</strong>${badge(v.outcome ?? "Currently Visiting")}</div><div class="visit-meta"><span>${personCell(v.visitor_id)}</span><span>In ${time(v.checked_in_at)}</span><span>Out ${time(v.checked_out_at)}</span><span>${duration(v)}</span></div><span class="map-chip">⌖ GPS ${h(availability.replace("_", " "))}${availability === "captured" ? ` · ±${Math.round(v.location.accuracy)}m` : ""}</span><p>${h(v.notes || "Visit in progress. Discussion is recorded at checkout.")}</p>${v.order_status !== "No Order" ? `<p><strong>${h(v.order_status)}</strong> · ${h(v.order_note)}${v.order_value !== null ? ` · Approx. AED ${Number(v.order_value).toLocaleString("en-AE")}` : ""}</p>` : ""}</article>`;
}
function renderProfile() {
  const { shop: s, visits, followups } = profile!,
    active = visits.find((v) => v.lifecycle === "open" && v.visitor_id === me.actor.id),
    anotherActive = dashboard.active.find((v: Row) => v.visitor_id === me.actor.id && v.shop_id !== s.id);
  const checkAction = !executive()
    ? ""
    : active
      ? button("Complete visit · Check out", `data-checkout="${h(active.id)}"`, true)
      : anotherActive
        ? button("Finish your current visit first", `data-shop="${h(anotherActive.shop_id)}"`)
      : button(
          "⌖ Check in to this shop",
          `data-checkin="${h(s.id)}" ${!visitEnabled() ? "disabled" : ""}`,
          true,
        );
  const pending = followups.filter((f) => f.status === "pending");
  return `${button("← Back to list", "data-back")}${heading("Shop record", "Shop profile", `${h(s.area)} · ${s.synthetic ? "Synthetic review record" : "Field discovery"}`)}<section class="panel"><div class="panel-body"><div class="hero-shop"><div><p class="eyebrow">${s.status === "Customer" ? "Shop profile" : "Field discovery · Lead"}</p><h2>${h(s.name)}</h2><p>${h(s.contact)} · <a href="tel:${h(s.phone.replace(/[^+\d]/g, ""))}">${h(s.phone)}</a></p><p>⌖ ${h(s.location || s.area)}</p></div><div class="shop-primary">${checkAction}<a class="followup-jump" href="#shop-followups">Follow-ups${pending.length ? ` (${pending.length} pending)` : ""} ↓</a></div></div><div class="grid-two section">${fact("ASSIGNED EXECUTIVE", person(s.assigned_executive_id))}${fact("SHOP STATUS", s.status)}${fact("LAST VISIT", date(visits[0]?.checked_in_at))}${fact("NEXT FOLLOW-UP", date(pending.map((f) => f.due_date).sort()[0]))}</div><div class="summary-strip section"><span><b>${visits.length}</b> total visits</span><span><b>${visits.filter((v) => businessDay(v.checked_in_at) === serverDay).length}</b> today</span><span>Added by ${h(person(s.created_by))}</span></div></div></section><div class="profile-main section"><div class="profile-history">${panel("Visit history", `${visits.length} recorded visits · Most recent first`, `<div class="panel-body visit-history">${visits.map(timeline).join("") || '<div class="empty">No visits yet. Check in to record the first visit.</div>'}</div>`)}</div><aside class="stack profile-sidebar">${panel("Shop information", "Shared context for every field visit", `<div class="panel-body grid-two">${fact("Contact person", s.contact)}${fact("Mobile", s.phone)}${fact("Area", s.area)}${fact("Added to CRM", date(s.created_at))}${fact("Notes", s.notes)}</div>`)}${panel("Follow-ups", "Each item keeps its own owner and visit", `<div class="panel-body">${executive() && visitEnabled() && visits.some(v => v.visitor_id === me.actor.id && v.lifecycle === "completed") ? button("Add follow-up", "data-add-followup") : ""}${followups.map((f) => `<article class="followup-item"><strong>${date(f.due_date)}</strong> ${badge(f.status)}<p class="subheading">${h(person(f.owner_id))} · Visit ${date(visits.find((v) => v.id === f.visit_id)?.checked_in_at)}</p>${f.status === "pending" && f.owner_id === me.actor.id && executive() && visitEnabled() ? `<div class="actions section">${button("Complete", `data-followup="${f.id}" data-action="complete"`)}${button("Reschedule", `data-followup="${f.id}" data-action="reschedule"`)}${button("Cancel", `data-followup="${f.id}" data-action="cancel"`)}</div>` : f.status === "pending" && supervisor() && visitEnabled() ? `<div class="actions section">${button("Assign executive", `data-followup="${f.id}" data-action="assign"`)}</div>` : ""}</article>`).join("") || '<p class="empty">Set an optional date when completing your visit.</p>'}</div>`, "shop-followups") }${panel("Record history", "Who changed this shop and when", `<div class="panel-body">${button("View record history", "data-audit")}${supervisor() ? `<details class="section"><summary>Manage shop</summary><p class="help">Changes need a reason and stay in record history.</p><div class="actions section">${button("Edit shop details", "data-edit-shop")}${button("Transfer shop", "data-transfer-shop")}</div></details>` : ""}</div>`)}</aside></div>`;
}
function currentDuty() {
  const s = duty.sessions.find(
    (s) => s.executive_id === me.actor.id && !s.ended_at,
  );
  const rest = s
    ? duty.rests.find((r) => r.session_id === s.id && !r.ended_at)
    : null;
  return { session: s, state: !s ? "off" : rest ? "rest" : "on" };
}
function dutyCard() {
  const current = currentDuty();
  return `<section class="notice duty-card"><div><strong>Your duty · ${current.state === "off" ? "Off duty" : current.state === "rest" ? "On break" : "On duty"}</strong><p>Duty timing is separate from shop visits.</p></div><div class="actions">${me.policies.duty !== "approved-v1" ? badge("Policy pending") : current.state === "off" ? button("Start duty", 'data-duty-action="start"') : current.state === "rest" ? button("Return to duty", 'data-duty-action="return"') : button("Start break", 'data-duty-action="rest"') + button("End duty", 'data-duty-action="end"')}</div></section>`;
}
function dutyTable() {
  return table(
    ["EXECUTIVE", "START", "END", "REST INTERVALS"],
    duty.sessions
      .map(
        (s) =>
          `<tr>${cell("EXECUTIVE", h(s.name))}${cell("START", `${date(s.started_at)} ${time(s.started_at)}`)}${cell("END", s.ended_at ? `${date(s.ended_at)} ${time(s.ended_at)}` : "Open")}${cell(
            "REST INTERVALS",
            duty.rests
              .filter((r) => r.session_id === s.id)
              .map(
                (r) =>
                  `${date(r.started_at)} ${time(r.started_at)} → ${r.ended_at ? date(r.ended_at) + " " + time(r.ended_at) : "Away"}`,
              )
              .join("<br>") || "—",
          )}</tr>`,
      )
      .join(""),
  );
}
function query() {
  const p = new URLSearchParams({ page: String(filters.page), q: filters.q });
  for (const k of ["person", "area", "status"] as const)
    if (filters[k]) p.set(k, filters[k]);
  if (view === "leads") p.set("lead", "true");
  if (view !== "visits" && filters.when) p.set("when", filters.when);
  if (view === "visits" && filters.when) {
    const day = serverDay || businessDay(new Date());
    p.set("to", filters.when === "yesterday" ? addDays(day, -1) : day);
    p.set(
      "from",
      filters.when === "today"
        ? day
        : filters.when === "yesterday"
          ? addDays(day, -1)
          : filters.when === "week"
            ? addDays(day, -6)
            : `${day.slice(0, 7)}-01`,
    );
  }
  return p.toString();
}
async function render() {
  managerView?.dispose();
  managerView = undefined;
  const ticket = ++epoch;
  fetching = true;
  $("content")?.setAttribute("aria-busy", "true");
  const focused = document.activeElement as HTMLInputElement | null;
  const cursor = focused?.id === "search" ? focused.selectionStart : null;
  try {
    let markup = "";
    if (!dashboard) {
      dashboard = await api("/dashboard");
      serverDay = dashboard.metrics.day;
    }
    if (selected) {
      const [result, currentDashboard] = await Promise.all([api(`/shops/${selected}`), api("/dashboard")]);
      if (ticket !== epoch) return;
      profile = result;
      dashboard = currentDashboard;
      serverDay = dashboard.metrics.day;
      markup = renderProfile();
    } else if (view === "dashboard" || view === "team") {
      const result = await api("/dashboard"),
        history = await api("/duty");
      if (ticket !== epoch) return;
      dashboard = result;
      duty = history;
      serverDay = dashboard.metrics.day;
      markup =
        view === "dashboard"
          ? supervisor() ? '<div id="managerReports" class="manager-reports"></div>' : renderDashboard()
          : heading(
              "Field team",
              "Sales executives",
              "Shared visit history for every executive. Duty history follows your account permissions.",
            ) +
            `<div class="team-grid">${teamCards()}</div>` +
            `<div class="section">${panel(executive() ? "Your duty history" : "Team duty history", "Most recent 100 sessions · Asia/Dubai", dutyTable())}</div>`;
    } else {
      const result = await api(
        `/${view === "visits" ? "visits" : "shops"}?${query()}`,
      );
      if (ticket !== epoch) return;
      list = result;
      markup =
        view === "visits"
          ? heading(
              "All field activity",
              "Visit history",
              "Searchable arrival, departure, discussion and outcome history.",
            ) +
            panel(
              "Recorded visits",
              "Times are displayed in Asia/Dubai",
              toolbar(true) + visitRows(list.rows) + pages(),
            )
          : renderShops();
    }
    if (ticket !== epoch || !$("content")) return;
    for (const id of ["desktopNav", "mobileNav"])
      $(id).innerHTML = nav
        .map(
          ([value, icon, label]) =>
            `<button type="button" data-view="${value}" aria-current="${value === view ? "page" : "false"}"><span class="icon" aria-hidden="true">${icon}</span><span>${value === "dashboard" ? executive() ? "Today" : "Overview" : label}</span></button>`,
        )
        .join("");
    $("crumb").textContent = selected
      ? "Shop profile"
      : view === "dashboard" ? executive() ? "Today" : "Overview" : nav.find((n) => n[0] === view)![2];
    $("content").innerHTML =
      `<p class="error" role="alert" id="saveError" hidden></p>${retryBanner()}${!visitEnabled() ? '<div class="notice section-gap">Visit recording is awaiting approval. You can search shops and read visit history.</div>' : ""}${markup}`;
    if (supervisor() && view === "dashboard" && !selected) {
      managerView = createManagerView({
        container: $("managerReports"), request: path => api(path), download: downloadReport,
        openShop: id => { selected = id; void render(); window.scrollTo(0, 0); },
        today: serverDay, team: meta.team as { id: string; name: string; role?: string }[],
      });
      await managerView.load();
    }
    if (cursor !== null && $("search")) {
      ($("search") as HTMLInputElement).focus();
      ($("search") as HTMLInputElement).setSelectionRange(cursor, cursor);
    }
  } catch (error) {
    showError(error);
  } finally {
    if (ticket === epoch) {
      fetching = false;
      $("content")?.removeAttribute("aria-busy");
    }
  }
}
async function downloadReport(path: string) {
  let response: Response;
  try { response = await fetch(`/api${path}`, { credentials: "same-origin" }); }
  catch { throw new Error("The report could not be downloaded. Check your connection and retry."); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) loginScreen("Your session has expired. Sign in to download a report.");
    throw new Error(data.error?.message ?? "The report could not be downloaded. Please retry.");
  }
  const blob = await response.blob(), url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "emerald-report";
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast("Your report is ready. Download started.");
}
function retryBanner() {
  return unconfirmed && retryOperation ? `<div class="notice section-gap" id="retrySave"><strong>Save not yet confirmed</strong><p>Reconnect, then retry the same save. Your original details are kept for this attempt.</p>${button("Retry save", "data-retry-save", true)}</div>` : "";
}
function field(
  name: string,
  label: string,
  type = "text",
  required = false,
  value = "",
  choices?: [string, string][],
) {
  const max = ({name:160, contact:120, phone:40, area:100, location:300, reason:1000, notes:5000, orderNote:1000} as Record<string,number>)[name] ?? 300;
  return `<div class="form-field ${type === "textarea" ? "full" : ""}"><label for="field-${name}">${label}${required ? " *" : ""}</label>${choices ? `<select class="select" name="${name}" id="field-${name}" ${required ? "required" : ""}>${options(choices, value)}</select>` : type === "textarea" ? `<textarea name="${name}" id="field-${name}" ${required ? "required" : ""} maxlength="${max}">${h(value)}</textarea>` : `<input class="input" name="${name}" id="field-${name}" type="${type}" value="${h(value)}" ${required ? "required" : ""} ${type === "date" ? `min="${serverDay}"` : type === "number" ? 'min="0" step="0.01" max="999999999"' : `maxlength="${max}"`} ${name === "area" ? 'list="known-areas"' : ""}>${name === "area" ? `<datalist id="known-areas">${meta.areas.map(a => `<option value="${h(a)}"></option>`).join("")}</datalist>` : ""}`}</div>`;
}
function dialog(
  title: string,
  description: string,
  body: string,
  actions: string,
) {
  $("dialogTitle").textContent = title;
  $("dialogDescription").textContent = description;
  $("dialogBody").innerHTML =
    `<p class="error" id="saveErrorDialog" role="alert" hidden></p>${body}`;
  $("dialogFoot").innerHTML = actions;
  ($("dialog") as HTMLDialogElement).showModal();
}
const submit = (label: string, value = "save") =>
  `<button class="button primary" type="submit" value="${value}">${label}</button>`;
function checkoutForm(id: string) {
  formAction = "checkout";
  formId = id;
  dialog(
    "Complete your visit",
    profile!.shop.name,
    `<div class="form-grid">${field(
      "outcome",
      "Visit outcome",
      "select",
      true,
      "Regular Visit",
      outcomes.map((x) => [x, x]),
    )}${field("notes", "What did you discuss?", "textarea", true)}${field("followUpDate", "Follow-up date (optional)", "date")}</div><details class="section"><summary>Order details (optional)</summary><div class="form-grid section">${field(
      "orderStatus",
      "Order status",
      "select",
      true,
      "No Order",
      orderStates.map((x) => [x, x]),
    )}${field("orderNote", "Order note / reference")}${field("orderValue", "Approximate order value · AED", "number")}</div><p class="help">Order interest only. This does not create an invoice.</p></details><p class="help section">A follow-up date creates a new item for you. Existing follow-ups stay unchanged.</p>`,
    submit("Check Out · Save Visit"),
  );
}
function leadForm() {
  formAction = "lead";
  dialog(
    "Add a new shop",
    "Save a discovery with its own history.",
    `<div class="form-grid">${field("name", "Shop name", "text", true)}${field("area", "Area", "text", true)}${field("contact", "Contact person")}${field("phone", "Mobile", "tel")}</div><details class="section"><summary>More shop details (optional)</summary><div class="form-grid section">${field("location", "Location")}${field("notes", "Notes", "textarea")}</div></details><p class="help section">Assigned to ${h(me.actor.name)}. You can check in after saving.</p>`,
    submit("Save New Shop"),
  );
}
function shopManagementForm(transfer: boolean) {
  const s = profile!.shop;
  formAction = transfer ? "transfer" : "shop-update";
  formId = s.id;
  dialog(transfer ? "Transfer shop" : "Edit shop details", s.name,
    `<div class="form-grid">${transfer ? field("assignedExecutiveId", "Assign shop to", "select", true, s.assigned_executive_id, meta.team.filter(p => p.role === "executive").map(p => [p.id, p.name])) : field("name", "Shop name", "text", true, s.name) + field("contact", "Contact person", "text", false, s.contact) + field("phone", "Mobile", "tel", false, s.phone) + field("area", "Area", "text", true, s.area) + field("location", "Location", "text", false, s.location) + field("notes", "Shop notes", "textarea", false, s.notes)}${field("reason", "Reason for this change", "textarea", true)}</div>${transfer ? '<p class="help section">Only the shop assignment changes. Past visits and existing follow-ups keep their owners. This transfer is recorded in history.</p>' : ""}`,
    submit(transfer ? "Review transfer" : "Save shop details"));
}
function addFollowupForm() {
  formAction = "followup-create";
  const visits = profile!.visits.filter(v => v.visitor_id === me.actor.id && v.lifecycle === "completed");
  dialog("Add follow-up", profile!.shop.name,
    `<div class="form-grid">${field("dueDate", "Follow-up date", "date", true, serverDay)}${field("visitId", "For your visit on", "select", true, visits[0].id, visits.map(v => [v.id, `${date(v.checked_in_at)} · ${time(v.checked_in_at)}`]))}</div><p class="help section">This adds a new follow-up assigned to you. Other follow-ups stay unchanged.</p>`, submit("Save follow-up"));
}
async function auditHistory(page = 0) {
  const result = await api(`/shops/${profile!.shop.id}/audit?page=${page}`);
  formAction = "";
  const labels: Record<string, string> = {"shop.update":"Shop details changed", "shop.transfer":"Shop transferred", "followup.assign":"Follow-up assigned", "followup.create":"Follow-up added", "followup.complete":"Follow-up completed", "followup.reschedule":"Follow-up rescheduled", "followup.cancel":"Follow-up cancelled", "visit.checkin":"Visit check-in", "visit.checkout":"Visit completed", "shop.create":"Shop created"};
  const rows = result.rows.map((row: Row) => `<article class="followup-item"><strong>${h(labels[row.action] ?? String(row.action).replaceAll(".", " "))}</strong><p>${h(row.actor_name)} · ${date(row.happened_at)} ${time(row.happened_at)}</p>${row.details?.reason ? `<p>${h(row.details.reason)}</p>` : ""}</article>`).join("");
  dialog("Record history", profile!.shop.name, rows || '<p class="empty">No changes recorded yet.</p>', button("Previous", `data-audit-page="${page - 1}" ${page === 0 ? "disabled" : ""}`) + button("Next", `data-audit-page="${page + 1}" ${(page + 1) * result.pageSize >= result.total ? "disabled" : ""}`) + button("Close", "data-dismiss"));
}
async function gps() {
  if (!navigator.geolocation || !isSecureContext)
    return { availability: "unavailable" };
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          availability: "captured",
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          capturedAt: new Date(p.timestamp).toISOString(),
        }),
      (e) =>
        resolve({
          availability:
            e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable",
        }),
      { maximumAge: 60000, timeout: 3500 },
    ),
  );
}
async function mutateWork(work: () => Promise<unknown>, message: string) {
  if (submitting) return;
  if (unconfirmed && work !== retryOperation?.work) {
    showError(new Error("Use Retry save to confirm your previous action first."));
    return;
  }
  submitting = true;
  retryOperation = { work, message };
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).filter((b) => !b.disabled);
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("#dialogForm input, #dialogForm select, #dialogForm textarea")).filter(input => !input.disabled);
  buttons.forEach((b) => (b.disabled = true));
  inputs.forEach(input => input.disabled = true);
  ($("dialog") as HTMLDialogElement).setAttribute("aria-busy", "true");
  const saving = document.createElement("span");
  saving.className = "save-status";
  saving.setAttribute("role", "status");
  saving.textContent = "Saving…";
  (($("dialog") as HTMLDialogElement).open ? $("dialogFoot") : $("toasts")).prepend(saving);
  try {
    await work();
    retryOperation = null;
    ($("dialog") as HTMLDialogElement).close();
    toast(message);
    await render();
  } catch (error) {
    const alert = $("saveErrorDialog");
    if (alert && ($("dialog") as HTMLDialogElement).open) {
      alert.textContent =
        error instanceof Error ? error.message : "Save not confirmed.";
      alert.hidden = false;
    } else showError(error);
    if (unconfirmed) {
      if (alert && ($("dialog") as HTMLDialogElement).open)
        alert.insertAdjacentHTML("afterend", retryBanner());
      else if ($("content")) $("content").insertAdjacentHTML("afterbegin", retryBanner());
    } else retryOperation = null;
  } finally {
    submitting = false;
    buttons.forEach((b) => (b.disabled = false));
    if (!unconfirmed) {
      document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("#dialogForm input, #dialogForm select, #dialogForm textarea").forEach(input => input.disabled = false);
      document.querySelectorAll<HTMLButtonElement>("#dialogForm button[type=submit]").forEach(b => b.disabled = false);
    }
    else buttons.filter(b => b.type === "submit").forEach(b => b.disabled = true);
    ($("dialog") as HTMLDialogElement).removeAttribute("aria-busy");
    saving.remove();
  }
}
$("dialog").addEventListener("cancel", e => { if (submitting) e.preventDefault(); });
document.addEventListener("click", async (e) => {
  const target = (e.target as Element).closest<HTMLButtonElement>("button");
  if (!target || target.disabled || submitting) return;
  const d = target.dataset;
  try {
    if (d.retrySave !== undefined && retryOperation) {
      const operation = retryOperation;
      document.querySelectorAll("#retrySave").forEach(node => node.remove());
      await mutateWork(operation.work, operation.message);
      return;
    }
    if (unconfirmed && (d.add !== undefined || d.checkout || d.checkin || d.followup || d.addFollowup !== undefined || d.editShop !== undefined || d.transferShop !== undefined || d.dutyAction)) {
      showError(new Error("Your previous save is unconfirmed. Use Retry save first."));
      return;
    }
    if (d.logout !== undefined) {
      await api("/logout", {});
      resetWorkspace();
      me = undefined as any;
      loginScreen();
      return;
    }
    if (d.dismiss !== undefined) {
      ($("dialog") as HTMLDialogElement).close();
      return;
    }
    if (d.view) {
      view = d.view;
      selected = null;
      filters = { q: "", person: "", area: "", status: "", when: "", page: 0 };
      await render();
      window.scrollTo(0, 0);
      return;
    }
    if (d.clearFilters !== undefined) {
      clearTimeout(searchTimer);
      filters = { q: "", person: "", area: "", status: "", when: "", page: 0 };
      await render();
      return;
    }
    if (d.shop) {
      selected = d.shop;
      await render();
      window.scrollTo(0, 0);
      return;
    }
    if (d.back !== undefined) {
      selected = null;
      await render();
      return;
    }
    if (d.refresh !== undefined) {
      await render();
      return;
    }
    if (d.page) {
      filters.page = Number(d.page);
      await render();
      return;
    }
    if (d.person) {
      view = "visits";
      selected = null;
      filters = {
        q: "",
        person: d.person,
        area: "",
        status: "",
        when: "",
        page: 0,
      };
      await render();
      return;
    }
    if (d.add !== undefined) {
      leadForm();
      return;
    }
    if (d.editShop !== undefined || d.transferShop !== undefined) {
      shopManagementForm(d.transferShop !== undefined);
      return;
    }
    if (d.addFollowup !== undefined) { addFollowupForm(); return; }
    if (d.audit !== undefined || d.auditPage !== undefined) {
      await auditHistory(Number(d.auditPage ?? 0));
      return;
    }
    if (d.checkout) {
      checkoutForm(d.checkout);
      return;
    }
    if (d.checkin) {
      const shopId = d.checkin;
      await mutateWork(async () => {
        let body = checkinPayloads.get(shopId);
        if (!body) {
          body = { shopId, location: await gps() };
          checkinPayloads.set(shopId, body);
        }
        const result = await api("/checkin", body, true);
        checkinPayloads.delete(shopId);
        return result;
      }, "Check-in recorded.");
      return;
    }
    if (d.duty !== undefined) {
      duty = await api("/duty");
      formAction = "";
      dialog(
        executive() ? "Your duty history" : "Team duty history",
        "Server-recorded timing · Asia/Dubai",
        `${executive() ? dutyCard() : ""}${dutyTable()}`,
        button("Close", "data-dismiss"),
      );
      return;
    }
    if (d.dutyAction) {
      duty = await api("/duty");
      const current = currentDuty();
      await mutateWork(
        () =>
          api(
            `/duty/${d.dutyAction}`,
            { expectedSessionId: current.session?.id ?? null },
            true,
          ),
        d.dutyAction === "start" ? "Duty started." : d.dutyAction === "rest" ? "Break started." : d.dutyAction === "return" ? "You are back on duty." : "Duty ended.",
      );
      return;
    }
    if (d.followup) {
      formAction = `followup:${d.action}`;
      formId = d.followup;
      const f = profile!.followups.find((f) => f.id === formId)!;
      dialog(
        d.action === "assign" ? "Assign follow-up" : d.action === "complete" ? "Complete follow-up" : d.action === "cancel" ? "Cancel follow-up" : "Reschedule follow-up",
        `${date(f.due_date)} · ${person(f.owner_id)}`,
        `<div class="form-grid">${d.action === "assign" ? field("ownerId", "Assign to executive", "select", true, f.owner_id, meta.team.filter(p => p.role === "executive").map(p => [p.id, p.name])) : d.action === "reschedule" ? field("dueDate", "New due date", "date", true, f.due_date < serverDay ? serverDay : f.due_date) : ""}${field("reason", d.action === "complete" ? "Completion note" : "Reason for this change", "textarea", true, d.action === "complete" ? "Follow-up completed" : d.action === "reschedule" ? "Follow-up rescheduled" : "")}</div>`,
        submit(d.action === "cancel" ? "Review cancellation" : "Save follow-up"),
      );
      return;
    }
  } catch (error) {
    showError(error);
  }
});
let searchTimer: ReturnType<typeof setTimeout>;
document.addEventListener("toggle", (event) => {
  const details = event.target as HTMLDetailsElement;
  if (details.matches?.(".filter-options") && details.isConnected) filtersOpen = details.open;
}, true);
document.addEventListener("input", (e) => {
  const input = e.target as HTMLInputElement;
  if (input.id === "search") {
    filters.q = input.value;
    filters.page = 0;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void render(), 220);
  }
});
document.addEventListener("change", (e) => {
  const input = e.target as HTMLSelectElement;
  if (input.dataset.filter) {
    (filters as any)[input.dataset.filter] = input.value;
    filters.page = 0;
    void render();
  }
});
$("dialogForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  if (!form.reportValidity()) return;
  const fd = new FormData(form),
    data = Object.fromEntries(fd) as Record<string, string>;
  const action = formAction, id = formId;
  if (!action) return;
  const version = action.startsWith("followup:") ? profile!.followups.find(f => f.id === id)!.version : profile?.shop.version;
  if (action === "transfer" && !window.confirm(`Transfer ${profile!.shop.name} to ${person(data.assignedExecutiveId)}? Existing visits and follow-ups will keep their owners. The transfer and reason will be recorded.`)) return;
  if (action === "followup:cancel" && !window.confirm("Cancel this follow-up? Its history will be kept.")) return;
  void mutateWork(async () => {
    if (action === "checkout")
      await api(
        `/visits/${id}/checkout`,
        {
          ...data,
          orderValue: data.orderValue === "" ? null : Number(data.orderValue),
          followUpDate: data.followUpDate || null,
        },
        true,
      );
    if (action === "lead") {
      const result = await api(
        "/leads",
        {
          ...data,
          assignedExecutiveId: me.actor.id,
          checkIn: false,
          gps: { availability: "not_requested" },
        },
        true,
      );
      selected = result.shop.id;
      view = "leads";
    }
    if (action === "shop-update" || action === "transfer")
      await api(`/shops/${id}/${action === "transfer" ? "transfer" : "update"}`, {...data, version}, true);
    if (action === "followup-create")
      await api("/followups", data, true);
    if (action.startsWith("followup:")) {
      await api(
        `/followups/${id}${action === "followup:assign" ? "/assign" : ""}`,
        { ...data, ...(action === "followup:assign" ? {} : {action: action.split(":")[1]}), version },
        true,
      );
    }
  }, action === "checkout" ? "Visit completed and saved." : action === "lead" ? "New shop saved. You can now check in." : action.startsWith("followup") ? "Follow-up saved." : "Shop change saved in record history.");
});
window.addEventListener("offline", () =>
  toast(
    "Connection lost. Reconnect before saving; changes are not stored offline.",
  ),
);
window.addEventListener("online", () =>
  toast(
    "Connection available. Refresh history and retry any unconfirmed save.",
  ),
);
bootstrap().catch((error) =>
  loginScreen(
    error instanceof ApiError && error.status === 401
      ? ""
      : error instanceof Error
        ? error.message
        : "Server unavailable.",
  ),
);
