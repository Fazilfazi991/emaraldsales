import {
  addDays,
  businessDay,
  outcomes,
  orderStates,
  shopStatuses,
  type Actor,
} from "../src/domain.js";
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
  ["leads", "＋", "Leads"],
  ["team", "♙", "Sales Team"],
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
    throw new ApiError(
      0,
      "Connection lost. Save is unconfirmed. Reconnect and retry the same form; do not assume it was recorded.",
    );
  }
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== "/login")
      loginScreen(
        "Your session expired. Sign in, then check the shop history before retrying.",
      );
    throw new ApiError(
      response.status,
      data.error?.message ?? "The server could not confirm the action.",
    );
  }
  if (mutation) retryKeys.delete(signature);
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
const panel = (title: string, caption: string, body: string) =>
  `<section class="panel"><div class="panel-head"><div><h2 class="panel-title">${title}</h2><p class="panel-caption">${caption}</p></div></div>${body}</section>`;
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
const visitEnabled = () => me.policies.visit === "approved-v1";
const executive = () => me.actor.role === "executive";
function shell() {
  $("application").innerHTML =
    `<div class="shell"><aside class="sidebar" aria-label="Main navigation"><div class="brand"><img class="brand-thumb" src="/brand.png" alt="Emerald Interlink"><div><b>EMERALD INTERLINK</b><span>Field Sales CRM</span></div></div><div class="workspace-label">FIELD WORKSPACE</div><nav class="nav" id="desktopNav"></nav><div class="sidebar-foot"><b>EMERALD INTERLINK TRADING L.L.C</b><br>Dubai, United Arab Emirates<div class="connection"><span class="dot"></span>Local review · synthetic data</div><div>Online saves · UAE reporting time</div></div></aside><main class="main"><header class="topbar"><div class="crumb">Emerald Interlink / <b id="crumb">Dashboard</b></div><div class="top-actions"><span class="signed-in">${h(me.actor.name)} <small>${h(me.actor.role)}</small></span>${button("Duty", "data-duty")}${button("Sign out", "data-logout")}</div></header><div class="content" id="content" tabindex="-1"></div></main><nav class="mobile-nav" id="mobileNav" aria-label="Mobile navigation"></nav></div>`;
}
function loginScreen(message = "") {
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
      await bootstrap();
    } catch (error) {
      $("loginError").textContent =
        error instanceof Error ? error.message : "Sign-in failed.";
    } finally {
      submit.disabled = false;
    }
  });
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
function options(values: [string, string][], selected: string) {
  return values
    .map(
      ([value, label]) =>
        `<option value="${h(value)}" ${selected === value ? "selected" : ""}>${h(label)}</option>`,
    )
    .join("");
}
function toolbar(visits = false) {
  return `<div class="toolbar"><label class="search"><span class="search-icon">⌕</span><input class="input" id="search" placeholder="${visits ? "Search shop, executive or notes…" : "Search shop, mobile, contact or area…"}" aria-label="${visits ? "Search visits" : "Search shops"}" value="${h(filters.q)}"></label><select class="select" aria-label="Filter by sales executive" data-filter="person">${options([["", "All executives"], ...meta.team.filter((m) => m.role === "executive").map((m) => [m.id, m.name] as [string, string])], filters.person)}</select><select class="select" aria-label="Filter by area" data-filter="area">${options([["", "All areas"], ...meta.areas.map((a) => [a, a] as [string, string])], filters.area)}</select><select class="select" aria-label="Filter by status" data-filter="status">${options([["", "All statuses"], ...(visits ? [...outcomes, "Currently Visiting"] : shopStatuses).map((a) => [a, a] as [string, string])], filters.status)}</select><select class="select" aria-label="Filter by date or visit" data-filter="when">${options(
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
  )}</select><span class="results">${list.total} ${visits ? "visits" : view === "leads" ? "leads" : "shops"}</span></div>`;
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
      view === "leads" ? "Shop leads" : "Shops",
      "Search your shop network. Open a shop to review every past visit.",
      executive() ? button("＋ Add New Shop", "data-add", true) : "",
    ) +
    panel(
      view === "leads" ? "New shop leads" : "All shops",
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
    active = visits.find((v) => v.lifecycle === "open");
  const checkAction = !executive()
    ? ""
    : active
      ? active.visitor_id === me.actor.id
        ? button("✓ Check out", `data-checkout="${h(active.id)}"`, true)
        : button(
            `Currently visiting: ${h(person(active.visitor_id))}`,
            "disabled",
          )
      : button(
          "⌖ Check in to this shop",
          `data-checkin="${h(s.id)}" ${!visitEnabled() ? "disabled" : ""}`,
          true,
        );
  const pending = followups.filter((f) => f.status === "pending");
  return `${button("← Back to list", "data-back")}${heading("Shop record", "Shop profile", `${h(s.area)} · ${s.synthetic ? "Synthetic review record" : "Field discovery"}`)}<section class="panel"><div class="panel-body"><div class="hero-shop"><div><p class="eyebrow">${s.status === "Customer" ? "Shop profile" : "Field discovery · Lead"}</p><h2>${h(s.name)}</h2><p>${h(s.contact)} · <a href="tel:${h(s.phone.replace(/[^+\d]/g, ""))}">${h(s.phone)}</a></p><p>⌖ ${h(s.location || s.area)}</p></div><div>${checkAction}</div></div><div class="grid-two section">${fact("ASSIGNED EXECUTIVE", person(s.assigned_executive_id))}${fact("SHOP STATUS", s.status)}${fact("LAST VISIT", date(visits[0]?.checked_in_at))}${fact("NEXT FOLLOW-UP", date(pending.map((f) => f.due_date).sort()[0]))}</div><div class="summary-strip section"><span><b>${visits.length}</b> total visits</span><span><b>${visits.filter((v) => businessDay(v.checked_in_at) === serverDay).length}</b> today</span><span>Added by ${h(person(s.created_by))}</span></div></div></section><div class="profile-main section"><div>${panel("Visit history", `${visits.length} recorded visits · Most recent first`, `<div class="panel-body visit-history">${visits.map(timeline).join("") || '<div class="empty">No visits yet. Check in to record the first visit.</div>'}</div>`)}</div><aside class="stack">${panel("Shop information", "Shared context for every field visit", `<div class="panel-body grid-two">${fact("Contact person", s.contact)}${fact("Mobile", s.phone)}${fact("Area", s.area)}${fact("Added to CRM", date(s.created_at))}${fact("Notes", s.notes)}</div>`)}${panel("Follow-ups", "Each item retains its originating visit and owner", `<div class="panel-body">${followups.map((f) => `<article class="followup-item"><strong>${date(f.due_date)}</strong> ${badge(f.status)}<p class="subheading">${h(person(f.owner_id))} · Visit ${date(visits.find((v) => v.id === f.visit_id)?.checked_in_at)}</p>${f.status === "pending" && f.owner_id === me.actor.id && visitEnabled() ? `<div class="actions section">${button("Complete", `data-followup="${f.id}" data-action="complete"`)}${button("Reschedule", `data-followup="${f.id}" data-action="reschedule"`)}${button("Cancel", `data-followup="${f.id}" data-action="cancel"`)}</div>` : ""}</article>`).join("") || '<p class="empty">Set an optional date when checking out a visit.</p>'}</div>`)}</aside></div>`;
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
  return `<section class="notice duty-card"><div><strong>Your duty · ${current.state === "off" ? "Off duty" : current.state === "rest" ? "Away / rest" : "On duty"}</strong><p>Duty timing is separate from shop visits.</p></div><div class="actions">${me.policies.duty !== "approved-v1" ? badge("Policy pending") : current.state === "off" ? button("Start duty", 'data-duty-action="start"', true) : current.state === "rest" ? button("Return to duty", 'data-duty-action="return"', true) : button("Start rest", 'data-duty-action="rest"') + button("End duty", 'data-duty-action="end"')}</div></section>`;
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
  const ticket = ++epoch;
  fetching = true;
  const focused = document.activeElement as HTMLInputElement | null;
  const cursor = focused?.id === "search" ? focused.selectionStart : null;
  try {
    let markup = "";
    if (!dashboard) {
      dashboard = await api("/dashboard");
      serverDay = dashboard.metrics.day;
    }
    if (selected) {
      const result = await api(`/shops/${selected}`);
      if (ticket !== epoch) return;
      profile = result;
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
          ? renderDashboard()
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
            `<button type="button" data-view="${value}" aria-current="${value === view ? "page" : "false"}"><span class="icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`,
        )
        .join("");
    $("crumb").textContent = selected
      ? "Shop profile"
      : nav.find((n) => n[0] === view)![2];
    $("content").innerHTML =
      `<p class="error" role="alert" id="saveError" hidden></p>${!visitEnabled() ? '<div class="notice section-gap">Visit recording is unavailable while the open-visit and follow-up policy awaits approval. Search and shared history are available.</div>' : ""}${markup}`;
    if (cursor !== null && $("search")) {
      ($("search") as HTMLInputElement).focus();
      ($("search") as HTMLInputElement).setSelectionRange(cursor, cursor);
    }
  } catch (error) {
    showError(error);
  } finally {
    if (ticket === epoch) fetching = false;
  }
}
function field(
  name: string,
  label: string,
  type = "text",
  required = false,
  value = "",
  choices?: [string, string][],
) {
  return `<div class="form-field ${type === "textarea" ? "full" : ""}"><label for="field-${name}">${label}${required ? " *" : ""}</label>${choices ? `<select class="select" name="${name}" id="field-${name}">${options(choices, value)}</select>` : type === "textarea" ? `<textarea name="${name}" id="field-${name}" ${required ? "required" : ""} maxlength="5000">${h(value)}</textarea>` : `<input class="input" name="${name}" id="field-${name}" type="${type}" value="${h(value)}" ${required ? "required" : ""} ${type === "date" ? `min="${serverDay}"` : type === "number" ? 'min="0" step="0.01" max="999999999"' : 'maxlength="300"'}>`}</div>`;
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
    "Record this shop visit",
    profile!.shop.name,
    `<div class="form-grid">${field(
      "outcome",
      "Visit status",
      "select",
      true,
      "Regular Visit",
      outcomes.map((x) => [x, x]),
    )}${field(
      "orderStatus",
      "Order status",
      "select",
      true,
      "No Order",
      orderStates.map((x) => [x, x]),
    )}${field("notes", "Discussion / visit notes", "textarea", true)}${field("orderNote", "Order note / reference")}${field("orderValue", "Approximate order value · AED", "number")}${field("followUpDate", "New follow-up date", "date")}</div><p class="help">An optional new follow-up belongs to you. Existing follow-ups stay unchanged. Approximate order interest is not an invoice.</p>`,
    submit("Check Out · Save Visit"),
  );
}
function leadForm() {
  formAction = "lead";
  dialog(
    "Add a new shop",
    "Save a discovery with its own history.",
    `<div class="form-grid">${field("name", "Shop name", "text", true)}${field("contact", "Contact person")}${field("phone", "Mobile", "tel")}${field("area", "Area", "text", true)}${field("assignedExecutiveId", "Assigned executive", "select", true, me.actor.id, [[me.actor.id, me.actor.name]])}${field("location", "Location")}${field("notes", "Notes", "textarea")}</div><p class="help">Your signed-in account is recorded as the creator. Check-in uses the actual visitor, independently of assignment.</p>`,
    submit("Save New Shop") +
      (visitEnabled() ? submit("Save & Check In", "checkin") : ""),
  );
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
  submitting = true;
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).filter((b) => !b.disabled);
  buttons.forEach((b) => (b.disabled = true));
  try {
    await work();
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
  } finally {
    submitting = false;
    buttons.forEach((b) => (b.disabled = false));
  }
}
document.addEventListener("click", async (e) => {
  const target = (e.target as Element).closest<HTMLButtonElement>("button");
  if (!target || target.disabled) return;
  const d = target.dataset;
  try {
    if (d.logout !== undefined) {
      await api("/logout", {});
      retryKeys.clear();
      checkinPayloads.clear();
      me = undefined as any;
      dashboard = undefined as any;
      profile = null;
      selected = null;
      view = "dashboard";
      epoch++;
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
      const current = currentDuty();
      await mutateWork(
        () =>
          api(
            `/duty/${d.dutyAction}`,
            { expectedSessionId: current.session?.id ?? null },
            true,
          ),
        "Duty event recorded.",
      );
      return;
    }
    if (d.followup) {
      formAction = `followup:${d.action}`;
      formId = d.followup;
      const f = profile!.followups.find((f) => f.id === formId)!;
      dialog(
        "Update follow-up",
        `${date(f.due_date)} · ${person(f.owner_id)}`,
        `<div class="form-grid">${d.action === "reschedule" ? field("dueDate", "New due date", "date", true, f.due_date) : ""}${field("reason", "Reason / completion note", "textarea", true)}</div>`,
        submit("Save follow-up"),
      );
      return;
    }
  } catch (error) {
    showError(error);
  }
});
let searchTimer: ReturnType<typeof setTimeout>;
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
  void mutateWork(async () => {
    if (formAction === "checkout")
      await api(
        `/visits/${formId}/checkout`,
        {
          ...data,
          orderValue: data.orderValue === "" ? null : Number(data.orderValue),
          followUpDate: data.followUpDate || null,
        },
        true,
      );
    if (formAction === "lead") {
      const result = await api(
        "/leads",
        {
          ...data,
          checkIn:
            (e as SubmitEvent).submitter?.getAttribute("value") === "checkin",
          gps: { availability: "not_requested" },
        },
        true,
      );
      selected = result.shop.id;
      view = "leads";
    }
    if (formAction.startsWith("followup:")) {
      const f = profile!.followups.find((f) => f.id === formId)!;
      await api(
        `/followups/${formId}`,
        { ...data, action: formAction.split(":")[1], version: f.version },
        true,
      );
    }
  }, "Saved to the shared workspace.");
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
