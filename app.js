/* ============================================================
   DailySpace — desktop OS edition
   1. Store   — localStorage persistence (swap for a DB later)
   2. Router  — #/ = desktop, #/p/<id> = project window open
   3. Desktop — draggable icons, selection, dock
   4. Window  — project details in a macOS-style window
   ============================================================ */

/* ---------- accent palette (cycled across projects) ---------- */

const ACCENTS = ["#b3543a", "#4f7a63", "#5b6aa8", "#96608f", "#b08d45"];

function accentFor(id) {
  const idx = state.projects.findIndex((p) => p.id === id);
  return ACCENTS[((idx % ACCENTS.length) + ACCENTS.length) % ACCENTS.length];
}

/* ---------- 1. STORE ---------- */

const Store = {
  KEY: "dailyspace-data-v3",

  load() {
    const raw = localStorage.getItem(this.KEY);
    if (raw) return JSON.parse(raw);

    // migrate from the previous version if it exists
    const old = localStorage.getItem("dailyspace-data-v2");
    if (old) {
      const data = JSON.parse(old);
      data.projects.forEach((p, i) => { if (!p.pos) p.pos = defaultPos(i); });
      return data;
    }
    return seedData();
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },
};

/* scatter positions (in % of the desktop) for new icons */
function defaultPos(i) {
  const spots = [
    { x: 18, y: 30 }, { x: 42, y: 52 }, { x: 70, y: 26 },
    { x: 26, y: 66 }, { x: 62, y: 64 }, { x: 84, y: 48 },
    { x: 12, y: 50 }, { x: 50, y: 22 },
  ];
  const s = spots[i % spots.length];
  return { x: s.x, y: s.y };
}

function seedData() {
  const g = (text, done = false) => ({ id: uid(), text, done });
  return {
    projects: [
      {
        id: uid(),
        name: "DailySpace Website",
        description: "This very site — a calm hub for all my projects.",
        focus: "Make it feel like a desktop, not a document",
        goals: [g("Launch on localhost", true), g("Push to GitHub"), g("Hook up a real database")],
        tasks: [
          g("Sketch the hub layout", true),
          g("Build project pages", true),
          g("Desktop-OS redesign", true),
          g("Set up a GitHub repo"),
          g("Deploy a live version"),
        ],
        notes: "Inspired by the Makos Framer template — scattered icons, selection states, dock.\n\nLater: swap the Store object for an API + database.",
        pos: { x: 18, y: 30 },
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        name: "Fitness & Health",
        description: "Consistent training and better sleep, one week at a time.",
        focus: "Run 5k without stopping",
        goals: [g("Run a 5k by September"), g("Sleep 7+ hours on weekdays", true)],
        tasks: [
          g("Morning run — Mon/Wed/Fri", true),
          g("Meal prep on Sundays", true),
          g("Book a dental checkup"),
          g("Try one yoga session"),
        ],
        notes: "Week 3 of the couch-to-5k plan. Knees feel fine, pace ~7:30/km.",
        pos: { x: 45, y: 55 },
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        name: "Learn System Design",
        description: "Interview prep and general engineering depth.",
        focus: "Finish the scalability chapter this week",
        goals: [g("Complete DDIA book"), g("Design 5 practice systems")],
        tasks: [
          g("Read DDIA ch. 1–2", true),
          g("Notes on load balancing", true),
          g("Design a URL shortener"),
          g("Design a chat app"),
          g("Mock interview with a friend"),
        ],
        notes: "Resources: DDIA, system-design-primer on GitHub, Neetcode videos.",
        pos: { x: 71, y: 28 },
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* desktop widgets: phone & book — crisp SVG icons, tinted per widget */
const WIDGET_ICONS = {
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4.2 12.6c.7.55 1.2 1.35 1.2 2.24V18h6v-1.16c0-.89.5-1.69 1.2-2.24A7 7 0 0 0 12 2z"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
};

/* source: which list inside a project the widget collects from */
const WIDGETS = {
  call: { icon: WIDGET_ICONS.phone, tint: "#4ade80", source: "tasks", label: "Calls", title: "People to call", empty: "No calls on your list. Tag a task with the phone icon when adding it." },
  read: { icon: WIDGET_ICONS.book, tint: "#60a5fa", source: "tasks", label: "Reading", title: "Things to read", empty: "Nothing to read yet. Tag a task with the book icon when adding it." },
  think: { icon: WIDGET_ICONS.bulb, tint: "#fbbf24", source: "tasks", label: "Thinking", title: "Things to think through", empty: "Nothing to think through yet. Tag a task with the bulb icon when adding it." },
  write: { icon: WIDGET_ICONS.pen, tint: "#c084fc", source: "tasks", label: "Writing", title: "Things to write", empty: "Nothing to write yet. Tag a task with the pen icon when adding it." },
};

/* fills in any fields older / imported data might be missing */
function ensureDefaults(s) {
  if (!s.projects) s.projects = [];
  s.projects.forEach((p, i) => {
    if (!p.pos) p.pos = defaultPos(i);
    if (!p.goals) p.goals = [];
    if (!p.tasks) p.tasks = [];
    if (p.notes === undefined) p.notes = "";
  });
  if (!s.widgets) s.widgets = {};
  if (!s.widgets.call) s.widgets.call = { x: 92, y: 9 };
  if (!s.widgets.read) s.widgets.read = { x: 92, y: 30 };
  if (!s.widgets.think) s.widgets.think = { x: 92, y: 51 };
  if (!s.widgets.write) s.widgets.write = { x: 92, y: 72 };
  if (!s.links) s.links = [];
  if (!s.period) s.period = "day";
  if (s.timebarHidden === undefined) s.timebarHidden = false;
  return s;
}

let state = ensureDefaults(Store.load());

/* ---------- cloud sync (Supabase) ---------- */

const SUPABASE_URL = "https://xktzviuelnrfqpazdtvl.supabase.co";
const SUPABASE_KEY = "sb_publishable_2kD95uDSNPp0eF1ocE9gQQ_S9wVwdZA";
const OWNER_EMAIL = "gowdhaman.durairaj1998@gmail.com"; // the space belongs to this account
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const cloud = { user: null, timer: null, status: "signedout", ready: false };

if (db) {
  db.auth.onAuthStateChange((_event, session) => {
    cloud.ready = true;
    const hadUser = !!cloud.user;
    cloud.user = session ? session.user : null;
    if (cloud.user && !hadUser) loadCloud();
    else route(); // no session → show the password gate
    if (!cloud.user) { cloud.status = "signedout"; updateSyncChip(); }
  });
}

/* on login: cloud is the source of truth; first login pushes local data up */
async function loadCloud() {
  cloud.status = "loading";
  updateSyncChip();
  const { data: row, error } = await db.from("spaces").select("data").maybeSingle();
  if (error) { cloud.status = "error"; updateSyncChip(); return; }
  if (row && row.data) {
    state = ensureDefaults(row.data);
    Store.save(state);
    cloud.status = "synced";
    route();
  } else {
    await cloudSaveNow(); // nothing in the cloud yet → upload this device's data
  }
  updateSyncChip();
}

async function cloudSaveNow() {
  if (!db || !cloud.user) return;
  cloud.status = "saving";
  updateSyncChip();
  const { error } = await db.from("spaces").upsert({
    user_id: cloud.user.id,
    data: state,
    updated_at: new Date().toISOString(),
  });
  cloud.status = error ? "error" : "synced";
  updateSyncChip();
}

function scheduleCloudSave() {
  if (!db || !cloud.user) return;
  clearTimeout(cloud.timer);
  cloud.status = "saving";
  updateSyncChip();
  cloud.timer = setTimeout(cloudSaveNow, 900);
}

const SYNC_LABELS = {
  signedout: "Locked", loading: "Loading", saving: "Saving",
  synced: "Synced", error: "Offline",
};

/* "day" → "Day" */
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function syncChipHtml() {
  return `<span class="sync-dot"></span>${SYNC_LABELS[cloud.status] || ""}`;
}

function updateSyncChip() {
  const el = document.getElementById("sync-chip");
  if (el) {
    el.dataset.state = cloud.status;
    el.innerHTML = syncChipHtml();
    el.title = cloud.user ? `Signed in as ${cloud.user.email} — click to sign out` : "Sign in to sync across devices";
  }
}

/* full-screen password gate — the only way in */
function renderGate(message) {
  app.innerHTML = `
    <div class="desktop">
      <div class="gate">
        <div class="gate-card">
          <div class="gate-logo">Daily<em>Space</em></div>
          ${cloud.ready ? `
            <input type="password" id="gate-pass" placeholder="Enter password" maxlength="100" autocomplete="current-password" />
            <p class="form-error" id="gate-error">${message || ""}</p>
            <button class="btn btn-primary gate-btn" id="gate-enter">Enter</button>
          ` : `<p class="form-note">Loading…</p>`}
        </div>
      </div>
    </div>
  `;

  const pass = app.querySelector("#gate-pass");
  if (!pass) return;
  pass.focus();

  async function unlock() {
    const password = pass.value;
    if (password.length < 6) return;
    const errorEl = app.querySelector("#gate-error");
    const btn = app.querySelector("#gate-enter");
    btn.textContent = "…";
    errorEl.textContent = "";

    const { error } = await db.auth.signInWithPassword({ email: OWNER_EMAIL, password });
    if (!error) return; // onAuthStateChange opens the desktop

    if (/invalid login/i.test(error.message)) {
      // first ever visit: no account yet → this password becomes THE password
      const { data, error: e2 } = await db.auth.signUp({ email: OWNER_EMAIL, password });
      if (!e2 && data.session) return;
      if (!e2 && data.user) {
        errorEl.textContent = "First-time setup: confirm the email we just sent, then enter again.";
        btn.textContent = "Enter";
        return;
      }
      errorEl.textContent = "Wrong password.";
    } else {
      errorEl.textContent = error.message;
    }
    btn.textContent = "Enter";
    pass.select();
  }

  app.querySelector("#gate-enter").addEventListener("click", unlock);
  pass.addEventListener("keydown", (e) => { if (e.key === "Enter") unlock(); });
}

let selectedId = null;
let winMax = false;       // is the open window full screen?
let minimizedId = null;   // project whose window is minimized to the dock

function persist() {
  Store.save(state);      // instant local save
  scheduleCloudSave();    // debounced cloud save when signed in
}
persist();

function getProject(id) {
  return state.projects.find((p) => p.id === id);
}

/* ---------- helpers ---------- */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* favicon chain. faviconV2 returns a real 404 when a site has no icon
   (unlike the old s2 endpoint, which sent back a fake globe), so any
   image that loads is the site's genuine icon — at whatever size exists.
   Chain: faviconV2 → site's apple-touch icon → site's favicon.ico → our globe. */
function faviconUrl(host) {
  return "https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL"
    + `&url=https://${host}&size=128`;
}

window.faviconCheck = function () { /* any loaded image is genuine — keep it */ };

/* "calendar.proton.me" → "proton.me" (icon services index root domains) */
function rootDomain(host) {
  const parts = host.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : host;
}

window.faviconNext = function (img) {
  const host = img.dataset.host;
  const root = rootDomain(host);
  // build the source list once: subdomain first, then root domain
  const sources = [faviconUrl(host)];
  if (root !== host) sources.push(faviconUrl(root));
  sources.push(`https://${host}/favicon.ico`);
  if (root !== host) sources.push(`https://${root}/favicon.ico`);

  const stage = +img.dataset.stage + 1;
  img.dataset.stage = String(stage);
  if (stage < sources.length) {
    img.src = sources[stage];
  } else {
    img.style.display = "none";
    img.nextElementSibling.style.display = "flex";
  }
};

const CHECK_SVG =
  '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.5 9L10 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11 5.93"/><path d="M14 10a5 5 0 00-7.07 0l-2.83 2.83a5 5 0 007.07 7.07L13 18.07"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
};

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* menu bar date: "Tue, Jul 7" */
function menuDate() {
  const d = new Date();
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* digital clock: "21:04" with a pulsing colon */
function clockNow() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}<span class="clock-colon">:</span>${m}`;
}

/* ---------- time progress (day / week / month / quarter / year) ---------- */

const PERIODS = ["day", "week", "month", "quarter", "year"];

function periodRange(period) {
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth();
  let start, end;
  switch (period) {
    case "day":
      start = new Date(y, mo, now.getDate());
      end = new Date(y, mo, now.getDate() + 1);
      break;
    case "week": {
      const dow = (now.getDay() + 6) % 7; // Monday = 0
      start = new Date(y, mo, now.getDate() - dow);
      end = new Date(y, mo, now.getDate() - dow + 7);
      break;
    }
    case "month":
      start = new Date(y, mo, 1);
      end = new Date(y, mo + 1, 1);
      break;
    case "quarter": {
      const qm = Math.floor(mo / 3) * 3;
      start = new Date(y, qm, 1);
      end = new Date(y, qm + 3, 1);
      break;
    }
    case "year":
      start = new Date(y, 0, 1);
      end = new Date(y + 1, 0, 1);
      break;
  }
  return { start, end };
}

function timeProgress(period) {
  const { start, end } = periodRange(period);
  const now = Date.now();
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));

  const ms = end - now;
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  let left;
  if (days >= 2) left = `${days}d left`;
  else if (hours >= 1) left = `${hours}h ${mins % 60}m left`;
  else left = `${mins}m left`;

  return { pct, left };
}

function updateTimebar() {
  const { pct, left } = timeProgress(state.period);

  const fill = document.getElementById("tb-fill");
  const label = document.getElementById("tb-label");
  if (fill) {
    fill.style.width = pct + "%";
    label.textContent = `${Math.round(pct)}% · ${left}`;
  }

  // condensed version inside the menu bar toggle
  const miniFill = document.getElementById("tb-mini-fill");
  const miniLabel = document.getElementById("tb-mini-label");
  if (miniFill) {
    miniFill.style.width = pct + "%";
    miniLabel.textContent = `${cap(state.period)} · ${Math.round(pct)}%`;
  }
}

/* one global ticker keeps the clock & timebar alive across re-renders */
setInterval(() => {
  const el = document.getElementById("menu-clock");
  if (el) el.innerHTML = clockNow();
  updateTimebar();
}, 1000);

/* ---------- 2. ROUTER ---------- */

const app = document.getElementById("app");

function route() {
  // locked until the password is entered
  if (db && !cloud.user) { renderGate(); return; }

  const wMatch = window.location.hash.match(/^#\/w\/(call|read|think|write)$/);
  if (wMatch) { renderDesktop(null, wMatch[1]); return; }

  const match = window.location.hash.match(/^#\/p\/(.+)$/);
  const openId = match && getProject(match[1]) ? match[1] : null;
  if (openId && minimizedId === openId) minimizedId = null; // restoring from dock
  if (!openId && !minimizedId) winMax = false; // closed for real → forget full screen
  renderDesktop(openId);
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

/* ---------- 3. DESKTOP ---------- */

function taggedTasks(tag) {
  const source = WIDGETS[tag].source; // "tasks" or "goals"
  const out = [];
  state.projects.forEach((p) => {
    p[source].forEach((t) => { if (t.tag === tag) out.push({ task: t, project: p }); });
  });
  return out;
}

function renderDesktop(openId, widgetKind) {
  const widgets = Object.entries(WIDGETS)
    .map(([kind, w]) => {
      const pending = taggedTasks(kind).filter((x) => !x.task.done).length;
      const pos = state.widgets[kind];
      return `
        <div class="widget" data-widget="${kind}" style="left:${pos.x}%; top:${pos.y}%; --wt:${w.tint}">
          <div class="widget-tile">${w.icon}
            ${pending ? `<span class="widget-badge">${pending}</span>` : ""}
          </div>
          <div class="icon-label">${w.label}</div>
        </div>`;
    })
    .join("");

  const icons = state.projects
    .map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.done).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return `
        <div class="icon ${p.id === selectedId ? "selected" : ""}"
             data-icon="${p.id}"
             style="--pa:${accentFor(p.id)}; left:${p.pos.x}%; top:${p.pos.y}%">
          <div class="icon-thumb">
            <span>${initials(p.name)}</span>
            <div class="icon-progress" style="width:${pct}%"></div>
          </div>
          <div class="icon-label">${escapeHtml(p.name)}</div>
        </div>`;
    })
    .join("");

  app.innerHTML = `
    <div class="desktop" data-desktop>
      <div class="menubar">
        <span class="wordmark">Daily<em>Space</em></span>
        <div class="menubar-right">
          <button class="sync-chip" id="sync-chip" data-sync data-state="${cloud.status}">${syncChipHtml()}</button>
          <span class="menu-sep"></span>
          <span class="menu-datetime">
            <span class="menu-date">${menuDate()}</span>
            <span class="menu-clock" id="menu-clock">${clockNow()}</span>
          </span>
          <span class="menu-sep"></span>
          <button class="tb-toggle ${state.timebarHidden ? "collapsed" : ""}" data-tb-toggle
            title="${state.timebarHidden ? "Show" : "Hide"} time progress">
            <span class="tb-mini-wrap">
              <span class="tb-mini-label" id="tb-mini-label">${cap(state.period)} · ${Math.round(timeProgress(state.period).pct)}%</span>
              <span class="tb-mini"><span class="tb-mini-fill" id="tb-mini-fill" style="width:${timeProgress(state.period).pct}%"></span></span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
      </div>

      ${state.timebarHidden ? "" : `
      <div class="timebar">
        <div class="timebar-switch">
          ${PERIODS.map((p) => `
            <button class="tb-btn ${p === state.period ? "active" : ""}" data-period="${p}">${p}</button>
          `).join("")}
        </div>
        <div class="timebar-track"><div class="timebar-fill" id="tb-fill" style="width:${timeProgress(state.period).pct}%"></div></div>
        <span class="timebar-label" id="tb-label">${Math.round(timeProgress(state.period).pct)}% · ${timeProgress(state.period).left}</span>
      </div>`}

      <div class="desktop-items ${state.timebarHidden ? "" : "with-timebar"}" data-items>
      ${icons}
      ${widgets}
      ${state.links.map((l) => `
        <div class="linkicon" data-link="${l.id}" style="left:${l.pos.x}%; top:${l.pos.y}%">
          <div class="linkicon-tile">
            <img src="${faviconUrl(new URL(l.url).hostname)}"
                 alt="" data-host="${escapeHtml(new URL(l.url).hostname)}" data-stage="0"
                 onload="faviconCheck(this)" onerror="faviconNext(this)" />
            <span class="linkicon-fallback" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5a14.5 14.5 0 0 1 3.8 9.5 14.5 14.5 0 0 1-3.8 9.5 14.5 14.5 0 0 1-3.8-9.5A14.5 14.5 0 0 1 12 2.5z"/></svg></span>
            <span class="linkicon-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></span>
          </div>
          <div class="icon-label">${escapeHtml(l.name)}</div>
        </div>`).join("")}
      </div>

      ${state.projects.length ? "" : `<div class="desktop-hint">Your desktop is empty — press + in the dock to create a project</div>`}

      <div class="dock">
        <button class="dock-btn" data-tip="Add" data-dock-add>${ICONS.plus}</button>
        <div class="dock-sep"></div>
        <button class="dock-btn" data-tip="Tidy icons" data-dock-tidy>${ICONS.shuffle}</button>
        ${minimizedId && getProject(minimizedId) ? `
        <div class="dock-sep"></div>
        <button class="dock-btn" data-tip="${escapeHtml(getProject(minimizedId).name)}" data-dock-restore>
          <div class="dock-min-thumb" style="--pa:${accentFor(minimizedId)}">${initials(getProject(minimizedId).name)}</div>
        </button>` : ""}
      </div>
    </div>
    ${openId ? windowHtml(openId) : ""}
    ${widgetKind ? widgetWindowHtml(widgetKind) : ""}
  `;

  wireDesktop();
  if (openId) wireWindow(openId);
  if (widgetKind) wireWidgetWindow(widgetKind);
}

function wireDesktop() {
  const desktop = app.querySelector("[data-desktop]");
  const layer = app.querySelector("[data-items]"); // icon coordinate space (below the bars)

  // click empty desktop → clear selection
  desktop.addEventListener("pointerdown", (e) => {
    if (e.target === desktop || e.target === layer) {
      selectedId = null;
      app.querySelectorAll(".icon.selected").forEach((el) => el.classList.remove("selected"));
    }
  });

  // sync chip: click to lock the space again
  const syncChip = app.querySelector("[data-sync]");
  if (syncChip) syncChip.addEventListener("click", () => {
    if (db && cloud.user && confirm("Lock DailySpace?")) db.auth.signOut();
  });

  // hide / show the time progress bar
  const tbToggle = app.querySelector("[data-tb-toggle]");
  if (tbToggle) tbToggle.addEventListener("click", () => {
    state.timebarHidden = !state.timebarHidden;
    persist();
    route();
  });

  // time period switcher
  app.querySelectorAll("[data-period]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.period = btn.dataset.period;
      persist();
      app.querySelectorAll("[data-period]").forEach((b) =>
        b.classList.toggle("active", b.dataset.period === state.period)
      );
      updateTimebar();
    });
  });

  // dock
  app.querySelector("[data-dock-add]").addEventListener("click", showAddChooser);
  const restoreBtn = app.querySelector("[data-dock-restore]");
  if (restoreBtn) restoreBtn.addEventListener("click", () => {
    const id = minimizedId;
    minimizedId = null;
    if (window.location.hash === "#/p/" + id) route();
    else window.location.hash = "#/p/" + id;
  });
  app.querySelector("[data-dock-tidy]").addEventListener("click", () => {
    // compact grid: projects top-left row(s), links on the next row,
    // widgets stacked on the right edge
    const startX = 3.5, stepX = 6, perRow = 11, startY = 15, stepY = 15.5;
    state.projects.forEach((p, i) => {
      p.pos = { x: startX + (i % perRow) * stepX, y: startY + Math.floor(i / perRow) * stepY };
    });
    const linkY = startY + Math.ceil(state.projects.length / perRow) * stepY;
    state.links.forEach((l, i) => {
      l.pos = { x: startX + (i % perRow) * stepX, y: linkY + Math.floor(i / perRow) * stepY };
    });
    Object.keys(WIDGETS).forEach((k, i) => {
      state.widgets[k] = { x: 92, y: startY + i * stepY };
    });
    persist();
    renderDesktop(null);
  });

  // icons: drag / select / open
  app.querySelectorAll("[data-icon]").forEach((el) => {
    const id = el.dataset.icon;
    const project = getProject(id);

    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);

      const rect = layer.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = project.pos.x;
      const origY = project.pos.y;
      let dragged = false;

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragged && Math.hypot(dx, dy) > 5) {
          dragged = true;
          el.classList.add("dragging");
        }
        if (dragged) {
          project.pos.x = Math.min(96, Math.max(0, origX + (dx / rect.width) * 100));
          project.pos.y = Math.min(92, Math.max(4, origY + (dy / rect.height) * 100));
          el.style.left = project.pos.x + "%";
          el.style.top = project.pos.y + "%";
        }
      }

      function onUp() {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.classList.remove("dragging");

        if (dragged) persist(); // save the new position
        else window.location.hash = "#/p/" + id; // single click opens
      }

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    });
  });

  // web links: drag to move, click to confirm & open in a new tab
  app.querySelectorAll("[data-link]").forEach((el) => {
    const link = state.links.find((l) => l.id === el.dataset.link);

    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);

      const rect = layer.getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY;
      const origX = link.pos.x, origY = link.pos.y;
      let dragged = false;

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragged && Math.hypot(dx, dy) > 5) {
          dragged = true;
          el.classList.add("dragging");
        }
        if (dragged) {
          link.pos.x = Math.min(96, Math.max(0, origX + (dx / rect.width) * 100));
          link.pos.y = Math.min(92, Math.max(4, origY + (dy / rect.height) * 100));
          el.style.left = link.pos.x + "%";
          el.style.top = link.pos.y + "%";
        }
      }

      function onUp() {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.classList.remove("dragging");
        if (dragged) persist();
        else showOpenLinkModal(link);
      }

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    });
  });

  // floating widgets: drag to move, click to open
  app.querySelectorAll("[data-widget]").forEach((el) => {
    const kind = el.dataset.widget;
    const pos = state.widgets[kind];

    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);

      const rect = layer.getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY;
      const origX = pos.x, origY = pos.y;
      let dragged = false;

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragged && Math.hypot(dx, dy) > 5) {
          dragged = true;
          el.classList.add("dragging");
        }
        if (dragged) {
          pos.x = Math.min(96, Math.max(0, origX + (dx / rect.width) * 100));
          pos.y = Math.min(92, Math.max(4, origY + (dy / rect.height) * 100));
          el.style.left = pos.x + "%";
          el.style.top = pos.y + "%";
        }
      }

      function onUp() {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.classList.remove("dragging");
        if (dragged) persist();
        else window.location.hash = "#/w/" + kind;
      }

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    });
  });
}

/* ---------- add chooser: project or link? ---------- */

const FOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';

function showAddChooser() {
  if (app.querySelector(".window-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "window-backdrop";
  backdrop.innerHTML = `
    <div class="new-form">
      <h3>Add to desktop</h3>
      <div class="choice-row">
        <button class="choice-card" id="ch-project">
          ${FOLDER_SVG}
          <span class="choice-name">Project</span>
          <span class="choice-desc">Goals, tasks, focus & notes</span>
        </button>
        <button class="choice-card" id="ch-link">
          ${ICONS.link}
          <span class="choice-name">Link</span>
          <span class="choice-desc">Shortcut to a website</span>
        </button>
      </div>
    </div>
  `;
  app.appendChild(backdrop);

  function close() { backdrop.remove(); }

  backdrop.querySelector("#ch-project").addEventListener("click", () => { close(); showNewProjectModal(); });
  backdrop.querySelector("#ch-link").addEventListener("click", () => { close(); showNewLinkModal(); });
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  backdrop.querySelector("#ch-project").focus();
}

/* ---------- new project modal ---------- */

function showNewProjectModal() {
  if (app.querySelector(".window-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "window-backdrop";
  backdrop.innerHTML = `
    <div class="new-form">
      <h3>New project</h3>
      <input type="text" id="np-name" placeholder="Project name" maxlength="60" />
      <input type="text" id="np-desc" placeholder="Short description (optional)" maxlength="140" />
      <div class="row">
        <button class="btn btn-ghost" id="np-cancel">Cancel</button>
        <button class="btn btn-primary" id="np-create">Create</button>
      </div>
    </div>
  `;
  app.appendChild(backdrop);

  const nameInput = backdrop.querySelector("#np-name");
  nameInput.focus();

  function close() { backdrop.remove(); }

  function create() {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const project = {
      id: uid(),
      name,
      description: backdrop.querySelector("#np-desc").value.trim(),
      focus: "",
      goals: [],
      tasks: [],
      notes: "",
      pos: defaultPos(state.projects.length),
      createdAt: new Date().toISOString(),
    };
    state.projects.push(project);
    persist();
    window.location.hash = "#/p/" + project.id;
  }

  backdrop.querySelector("#np-create").addEventListener("click", create);
  backdrop.querySelector("#np-cancel").addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Enter") create();
    if (e.key === "Escape") close();
  });
}

/* ---------- link modals ---------- */

function showNewLinkModal() {
  if (app.querySelector(".window-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "window-backdrop";
  backdrop.innerHTML = `
    <div class="new-form">
      <h3>New link</h3>
      <input type="text" id="nl-name" placeholder="Name (e.g. GitHub)" maxlength="40" />
      <input type="text" id="nl-url" placeholder="URL (e.g. github.com)" maxlength="300" />
      <div class="row">
        <button class="btn btn-ghost" id="nl-cancel">Cancel</button>
        <button class="btn btn-primary" id="nl-create">Add to desktop</button>
      </div>
    </div>
  `;
  app.appendChild(backdrop);

  const nameInput = backdrop.querySelector("#nl-name");
  const urlInput = backdrop.querySelector("#nl-url");
  nameInput.focus();

  function close() { backdrop.remove(); }

  function create() {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    if (!url) { urlInput.focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try { new URL(url); } catch { urlInput.focus(); return; }

    state.links.push({
      id: uid(), name, url,
      pos: defaultPos(state.links.length + 3),
    });
    persist();
    close();
    renderDesktop(null);
  }

  backdrop.querySelector("#nl-create").addEventListener("click", create);
  backdrop.querySelector("#nl-cancel").addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Enter") create();
    if (e.key === "Escape") close();
  });
}

/* "Do you want to open this?" confirmation */
function showOpenLinkModal(link) {
  if (app.querySelector(".window-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "window-backdrop";
  backdrop.innerHTML = `
    <div class="new-form">
      <h3>Open “${escapeHtml(link.name)}”?</h3>
      <div class="link-url">${escapeHtml(link.url)}</div>
      <div class="row">
        <button class="btn btn-danger" id="ol-remove">Remove</button>
        <button class="btn btn-ghost" id="ol-cancel">Cancel</button>
        <button class="btn btn-primary" id="ol-open">Open</button>
      </div>
    </div>
  `;
  app.appendChild(backdrop);

  function close() { backdrop.remove(); }

  backdrop.querySelector("#ol-open").addEventListener("click", () => {
    window.open(link.url, "_blank", "noopener");
    close();
  });
  backdrop.querySelector("#ol-cancel").addEventListener("click", close);
  backdrop.querySelector("#ol-remove").addEventListener("click", () => {
    if (confirm(`Remove "${link.name}" from the desktop?`)) {
      state.links = state.links.filter((l) => l.id !== link.id);
      persist();
      close();
      renderDesktop(null);
    }
  });
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
    if (e.key === "Enter") { window.open(link.url, "_blank", "noopener"); close(); }
  });
  backdrop.querySelector("#ol-open").focus();
}

/* ---------- widget windows (Calls / Reading) ---------- */

function widgetWindowHtml(kind) {
  const w = WIDGETS[kind];
  const entries = taggedTasks(kind);
  const pending = entries.filter((x) => !x.task.done);
  const done = entries.filter((x) => x.task.done);

  const row = ({ task, project }) => `
    <li class="item ${task.done ? "done" : ""}" style="--pa:${accentFor(project.id)}">
      <button class="item-check" data-wtoggle="${task.id}" title="Toggle">${CHECK_SVG}</button>
      <span class="item-text">${escapeHtml(task.text)}</span>
      <button class="project-chip" data-goto="${project.id}" title="Open project">${escapeHtml(project.name)}</button>
    </li>`;

  return `
    <div class="window-backdrop" data-backdrop>
      <div class="window widget-window">
        <div class="window-titlebar">
          <div class="traffic">
            <button class="t-close" data-close title="Close"></button>
          </div>
          <div class="window-title">${w.title}</div>
        </div>
        <div class="window-body">
          ${entries.length ? `
            <ul class="item-list">
              ${pending.map(row).join("")}
              ${done.map(row).join("")}
            </ul>` : `<div class="empty-hint">${w.empty}</div>`}
        </div>
      </div>
    </div>
  `;
}

function wireWidgetWindow(kind) {
  const backdrop = app.querySelector("[data-backdrop]");

  function close() { window.location.hash = "#/"; }
  backdrop.querySelector("[data-close]").addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });

  backdrop.querySelectorAll("[data-wtoggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const taskId = btn.dataset.wtoggle;
      const source = WIDGETS[kind].source;
      state.projects.forEach((p) => {
        const t = p[source].find((x) => x.id === taskId);
        if (t) t.done = !t.done;
      });
      persist();
      renderDesktop(null, kind);
    });
  });

  backdrop.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => (window.location.hash = "#/p/" + btn.dataset.goto));
  });
}

/* ---------- 4. PROJECT WINDOW ---------- */

function windowHtml(id) {
  const p = getProject(id);
  const accent = accentFor(id);

  return `
    <div class="window-backdrop ${winMax ? "maximized" : ""}" data-backdrop>
      <div class="window" style="--pa:${accent}">
        <div class="window-titlebar">
          <div class="traffic">
            <button class="t-close" data-close title="Close"></button>
            <button class="t-min" data-minimize title="Minimize"></button>
            <button class="t-max" data-maximize title="Full screen"></button>
          </div>
          <div class="window-title">${escapeHtml(p.name)}</div>
        </div>
        <div class="window-body">
          <div class="project-hero">
            <input class="project-title" id="pj-name" value="${escapeHtml(p.name)}" maxlength="60" />
            <textarea class="project-desc" id="pj-desc" rows="1"
              placeholder="Add a short description...">${escapeHtml(p.description)}</textarea>
          </div>

          ${sectionHtml("goals", "Goals", p.goals, "Add a goal...")}
          ${sectionHtml("tasks", "Tasks", p.tasks, "Add a task...")}

          <div class="panel panel-notes">
            <div class="section-title">Notes</div>
            <textarea class="notes-area" id="pj-notes"
              placeholder="Ideas, links, anything...">${escapeHtml(p.notes)}</textarea>
            <div class="save-hint" id="save-hint">&nbsp;</div>
          </div>

          <div class="danger-row">
            <button class="btn btn-danger" id="pj-delete">Delete project</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function wireWindow(id) {
  const p = getProject(id);
  const backdrop = app.querySelector("[data-backdrop]");

  function close() {
    winMax = false;
    minimizedId = null;
    if (window.location.hash === "#/") route();
    else window.location.hash = "#/";
  }

  backdrop.querySelector("[data-close]").addEventListener("click", close);

  // yellow — minimize to the dock
  backdrop.querySelector("[data-minimize]").addEventListener("click", () => {
    minimizedId = id;
    window.location.hash = "#/";
  });

  // green — toggle full screen
  backdrop.querySelector("[data-maximize]").addEventListener("click", () => {
    winMax = !winMax;
    backdrop.classList.toggle("maximized", winMax);
  });

  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });

  // Inline editing: save on blur / Enter
  bindField("#pj-name", (v) => { p.name = v || p.name; });
  bindField("#pj-desc", (v) => { p.description = v; });

  // Notes autosave (debounced)
  const notes = backdrop.querySelector("#pj-notes");
  const hint = backdrop.querySelector("#save-hint");
  let timer = null;
  notes.addEventListener("input", () => {
    clearTimeout(timer);
    hint.textContent = "typing...";
    timer = setTimeout(() => {
      p.notes = notes.value;
      persist();
      hint.textContent = "saved";
      setTimeout(() => (hint.innerHTML = "&nbsp;"), 1500);
    }, 500);
  });

  bindItemSection("goals", p.goals, id);
  bindItemSection("tasks", p.tasks, id);

  backdrop.querySelector("#pj-delete").addEventListener("click", () => {
    if (confirm(`Delete "${p.name}"? This cannot be undone.`)) {
      state.projects = state.projects.filter((x) => x.id !== id);
      selectedId = null;
      persist();
      window.location.hash = "#/";
    }
  });

  function bindField(selector, apply) {
    const el = backdrop.querySelector(selector);
    const save = () => { apply(el.value.trim()); persist(); };
    el.addEventListener("blur", save);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && el.tagName !== "TEXTAREA") el.blur();
    });
  }
}

/* Builds the HTML for a checkable list panel (goals or tasks) */
function sectionHtml(kind, label, items, placeholder) {
  const doneCount = items.filter((i) => i.done).length;
  const rows = items
    .map(
      (item) => `
      <li class="item ${item.done ? "done" : ""}" data-id="${item.id}">
        <button class="item-check" data-toggle title="Toggle">${CHECK_SVG}</button>
        <span class="item-text">
          ${item.tag ? `<span class="item-tag" style="--wt:${WIDGETS[item.tag].tint}" title="${WIDGETS[item.tag].label}">${WIDGETS[item.tag].icon}</span>` : ""}${escapeHtml(item.text)}
        </span>
        <button class="item-delete" data-delete title="Delete">&times;</button>
      </li>`
    )
    .join("");

  // all four tags live on tasks; goals have none
  const tagButtons = kind === "tasks"
    ? Object.keys(WIDGETS)
        .map((t) => `<button class="tag-btn" data-tag-btn="${t}" style="--wt:${WIDGETS[t].tint}" title="Tag as ${WIDGETS[t].label.toLowerCase()}">${WIDGETS[t].icon}</button>`)
        .join("")
    : "";

  return `
    <div class="panel panel-${kind}" data-section="${kind}">
      <div class="section-title">${label}
        <span class="section-count">${items.length ? `${doneCount} / ${items.length}` : ""}</span>
      </div>
      <ul class="item-list">${rows}</ul>
      ${items.length ? "" : `<div class="empty-hint">No ${kind} yet.</div>`}
      <div class="add-row">
        <input type="text" data-add-input placeholder="${placeholder}" maxlength="200" />
        ${tagButtons}
        <button class="btn btn-ghost" data-add-btn>Add</button>
      </div>
    </div>
  `;
}

/* Wires up add / toggle / delete inside one panel */
function bindItemSection(kind, items, projectId) {
  const section = app.querySelector(`[data-section="${kind}"]`);
  const input = section.querySelector("[data-add-input]");
  let selectedTag = null;

  // tag picker (tasks only): click to select, click again to unselect
  section.querySelectorAll("[data-tag-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedTag = selectedTag === btn.dataset.tagBtn ? null : btn.dataset.tagBtn;
      section.querySelectorAll("[data-tag-btn]").forEach((b) =>
        b.classList.toggle("active", b.dataset.tagBtn === selectedTag)
      );
      input.focus();
    });
  });

  function rerender() {
    renderDesktop(projectId);
    const el = app.querySelector(`[data-section="${kind}"] [data-add-input]`);
    if (el) el.focus();
  }

  function add() {
    const text = input.value.trim();
    if (!text) return;
    items.push({ id: uid(), text, done: false, tag: selectedTag });
    persist();
    rerender();
  }

  section.querySelector("[data-add-btn]").addEventListener("click", add);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });

  section.querySelectorAll(".item").forEach((li) => {
    const item = items.find((i) => i.id === li.dataset.id);
    li.querySelector("[data-toggle]").addEventListener("click", () => {
      item.done = !item.done;
      persist();
      rerender();
    });
    li.querySelector("[data-delete]").addEventListener("click", () => {
      const idx = items.findIndex((i) => i.id === li.dataset.id);
      items.splice(idx, 1);
      persist();
      rerender();
    });
  });
}
