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
  pentool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg>',
};

/* source: which list inside a project the widget collects from */
const WIDGETS = {
  call: { icon: WIDGET_ICONS.phone, tint: "#4ade80", source: "tasks", label: "Calls", title: "People to call", empty: "No calls on your list. Tag a task with the phone icon when adding it." },
  read: { icon: WIDGET_ICONS.book, tint: "#60a5fa", source: "tasks", label: "Reading", title: "Things to read", empty: "Nothing to read yet. Tag a task with the book icon when adding it." },
  think: { icon: WIDGET_ICONS.bulb, tint: "#fbbf24", source: "tasks", label: "Think & Write", title: "Things to think through & write", empty: "Nothing here yet. Tag a task with the bulb icon when adding it." },
  sign: { icon: WIDGET_ICONS.pentool, tint: "#c084fc", source: "tasks", label: "Signatures", title: "Things to sign", empty: "Nothing to sign. Tag a task with the pen icon when adding it." },
};

/* fills in any fields older / imported data might be missing */
function ensureDefaults(s) {
  if (!s.projects) s.projects = [];
  s.projects.forEach((p, i) => {
    if (!p.pos) p.pos = defaultPos(i);
    if (!p.goals) p.goals = [];
    if (!p.tasks) p.tasks = [];
    if (p.notes === undefined) p.notes = "";
    // notes became a feed of individual note cards; migrate the old single field
    if (!p.notesList) {
      p.notesList = p.notes
        ? [{ id: uid(), text: p.notes, createdAt: new Date().toISOString() }]
        : [];
    }
    if (!p.docs) p.docs = [];   // standalone project docs
    if (!p.links) p.links = []; // project-level links
  });
  if (!s.widgets) s.widgets = {};
  if (!s.widgets.call) s.widgets.call = { x: 92, y: 9 };
  if (!s.widgets.read) s.widgets.read = { x: 92, y: 30 };
  if (!s.widgets.think) s.widgets.think = { x: 92, y: 51 };
  // "write" merged into "think"; its old slot becomes "sign"
  if (s.widgets.write) {
    if (!s.widgets.sign) s.widgets.sign = s.widgets.write;
    delete s.widgets.write;
    s.projects.forEach((p) =>
      [...(p.tasks || []), ...(p.goals || [])].forEach((t) => {
        if (t.tag === "write") t.tag = "think";
      })
    );
  }
  if (!s.widgets.sign) s.widgets.sign = { x: 92, y: 72 };
  if (!s.links) s.links = [];
  if (!s.collections) s.collections = [];
  if (!s.archived) s.archived = [];
  if (!s.archivePos) s.archivePos = { x: 92, y: 84 };
  if (!s.people) s.people = [];
  if (!s.peoplePos) s.peoplePos = { x: 92, y: 84 };
  if (!s.peopleEdges) s.peopleEdges = []; // person↔person connections [{a, b}]
  if (!s.mePos) s.mePos = { x: 50, y: 47 };
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
  // fallback_opts deliberately excludes URL: with it, Google "succeeds" with
  // an ugly generated globe for icon-less hosts; without it we get a clean 404
  // and can move down the chain instead.
  return "https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE"
    + `&url=https://${host}&size=128`;
}

/* belt-and-braces: if Google still sneaks a 16px default through, skip it */
window.faviconCheck = function (img) {
  if (img.src.includes("faviconV2") && img.naturalWidth < 24) window.faviconNext(img);
};

/* product-specific icons: Google serves one favicon per domain, so a Sheets
   link would show the generic Google icon. These stable overrides fix that. */
const ICON_OVERRIDES = [
  { match: (u) => u.hostname === "docs.google.com" && u.pathname.startsWith("/spreadsheets"),
    icon: "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_spreadsheet_x32.png" },
  { match: (u) => u.hostname === "docs.google.com" && u.pathname.startsWith("/document"),
    icon: "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_document_x32.png" },
  { match: (u) => u.hostname === "docs.google.com" && u.pathname.startsWith("/presentation"),
    icon: "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_presentation_x32.png" },
  { match: (u) => u.hostname === "docs.google.com" && u.pathname.startsWith("/forms"),
    icon: "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_form_x32.png" },
];

/* the right icon source for a full link URL (not just its domain) */
function linkIconSrc(urlStr) {
  try {
    const u = new URL(urlStr);
    for (const o of ICON_OVERRIDES) if (o.match(u)) return o.icon;
    return faviconUrl(u.hostname);
  } catch {
    return "";
  }
}

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

const NOTE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>';

const CHECK_SVG =
  '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.5 9L10 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11 5.93"/><path d="M14 10a5 5 0 00-7.07 0l-2.83 2.83a5 5 0 007.07 7.07L13 18.07"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
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

  const wMatch = window.location.hash.match(/^#\/w\/(call|read|think|sign)$/);
  if (wMatch) { renderDesktop(null, wMatch[1]); return; }

  // full-page note for a task/goal
  const nMatch = window.location.hash.match(/^#\/n\/([^/]+)\/(goals|tasks|docs)\/(.+)$/);
  if (nMatch) {
    const np = getProject(nMatch[1]);
    const nItem = np && np[nMatch[2]].find((i) => i.id === nMatch[3]);
    if (nItem) { renderNotePage(nMatch[1], nMatch[2], nMatch[3]); return; }
  }

  if (window.location.hash === "#/a") { renderDesktop(null, null, null, true); return; }
  if (window.location.hash === "#/people") { renderPeoplePage(); return; }

  const cMatch = window.location.hash.match(/^#\/c\/(.+)$/);
  if (cMatch && state.collections.find((c) => c.id === cMatch[1])) {
    renderDesktop(null, null, cMatch[1]);
    return;
  }

  const match = window.location.hash.match(/^#\/p\/(.+)$/);
  if (match && getProject(match[1])) { renderProjectPage(match[1]); return; }

  renderDesktop(null);
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

/* ---------- 3. DESKTOP ---------- */

function taggedTasks(tag) {
  const source = WIDGETS[tag].source; // "tasks" or "goals"
  const out = [];
  state.projects.forEach((p) => {
    if (isArchived("project", p.id)) return; // archived projects rest quietly
    p[source].forEach((t) => { if (t.tag === tag) out.push({ task: t, project: p }); });
  });
  return out;
}

/* is a project/link tucked inside some collection? */
function inCollection(type, id) {
  return state.collections.some((c) => c.items.some((i) => i.type === type && i.id === id));
}

/* ---------- people helpers ---------- */

const PEOPLE_COLORS = ["#4ade80", "#60a5fa", "#fbbf24", "#c084fc", "#f87171", "#2dd4bf", "#fb923c", "#a3e635"];

function personById(id) {
  return state.people.find((p) => p.id === id);
}

/* every task (in non-archived projects) connected to this person */
function tasksForPerson(pid) {
  const out = [];
  state.projects.forEach((p) => {
    if (isArchived("project", p.id)) return;
    p.tasks.forEach((t) => {
      if (t.people && t.people.includes(pid)) out.push({ task: t, project: p });
    });
  });
  return out;
}

/* person↔person connection edges (undirected) */
function connectedIds(pid) {
  return state.peopleEdges
    .filter((e) => e.a === pid || e.b === pid)
    .map((e) => (e.a === pid ? e.b : e.a));
}

function setConnections(pid, ids) {
  state.peopleEdges = state.peopleEdges.filter((e) => e.a !== pid && e.b !== pid);
  ids.forEach((other) => state.peopleEdges.push({ a: pid, b: other }));
}

/* small avatar chips shown on task rows */
function personChipsHtml(item) {
  if (!item.people || !item.people.length) return "";
  return item.people.map((pid) => {
    const per = personById(pid);
    if (!per) return "";
    return `<button class="pchip" data-pchip="${per.id}" style="--pc:${per.color}" title="${escapeHtml(per.name)}">${escapeHtml(per.name.charAt(0).toUpperCase())}</button>`;
  }).join("");
}

function isArchived(type, id) {
  return state.archived.some((a) => a.type === type && a.id === id);
}

/* hidden from desktop = in a collection OR archived */
function onDesktop(type, id) {
  return !inCollection(type, id) && !isArchived(type, id);
}

/* ---------- per-device layouts ----------
   Phones get their own position set (mpos / widgetsM / peoplePosM), so
   arranging icons on mobile never disturbs the desktop layout and vice versa. */

const IS_MOBILE = window.matchMedia("(max-width: 700px)").matches;

/* the active position object for this device class (drags mutate it in place) */
function P(obj) {
  return IS_MOBILE ? obj.mpos : obj.pos;
}

function widgetPos(kind) {
  return IS_MOBILE ? state.widgetsM[kind] : state.widgets[kind];
}

function peoplePosActive() {
  return IS_MOBILE ? state.peoplePosM : state.peoplePos;
}

/* clean 4-column grid sized for the phone screen */
function mobileTidy(persistIt = true) {
  const h = window.innerHeight || 700;
  const xs = [3, 27, 51, 75];
  const stepY = Math.min(19, (122 / h) * 100);
  const gridPos = (n) => ({ x: xs[n % 4], y: Math.min(84, 14 + Math.floor(n / 4) * stepY) });

  let n = 0;
  state.projects.filter((p) => onDesktop("project", p.id)).forEach((p) => (p.mpos = gridPos(n++)));
  n = Math.ceil(n / 4) * 4;
  state.links.filter((l) => onDesktop("link", l.id)).forEach((l) => (l.mpos = gridPos(n++)));
  n = Math.ceil(n / 4) * 4;
  state.collections.filter((c) => !isArchived("collection", c.id)).forEach((c) => (c.mpos = gridPos(n++)));
  n = Math.ceil(n / 4) * 4;
  state.widgetsM = {};
  Object.keys(WIDGETS).forEach((k) => (state.widgetsM[k] = gridPos(n++)));
  state.peoplePosM = gridPos(n++);

  if (persistIt) persist();
}

/* first visit on a phone (or new items): give everything a tidy spot */
function ensureMobileLayout() {
  if (!IS_MOBILE) return;
  const missing =
    state.projects.some((p) => onDesktop("project", p.id) && !p.mpos) ||
    state.links.some((l) => onDesktop("link", l.id) && !l.mpos) ||
    state.collections.some((c) => !isArchived("collection", c.id) && !c.mpos) ||
    !state.widgetsM || !state.peoplePosM;
  if (missing) mobileTidy(false);
}

/* iOS-folder-style mini preview: up to 4 tiles of what's inside */
function collectionPreview(c) {
  return c.items.slice(0, 4).map((it) => {
    if (it.type === "project") {
      const p = getProject(it.id);
      if (!p) return "";
      const a = accentFor(p.id);
      return `<span class="cmini" style="background:linear-gradient(135deg, ${a}, color-mix(in srgb, ${a} 55%, #000))"></span>`;
    }
    const l = state.links.find((x) => x.id === it.id);
    if (!l) return "";
    return `<span class="cmini cmini-link"><img src="${linkIconSrc(l.url)}" alt="" onerror="this.style.display='none'" /></span>`;
  }).join("");
}

function renderDesktop(openId, widgetKind, collectionId, archiveOpen) {
  ensureMobileLayout();

  const widgets = Object.entries(WIDGETS)
    .map(([kind, w]) => {
      const pending = taggedTasks(kind).filter((x) => !x.task.done).length;
      const pos = widgetPos(kind);
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
    .filter((p) => onDesktop("project", p.id))
    .map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.done).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return `
        <div class="icon ${p.id === selectedId ? "selected" : ""}"
             data-icon="${p.id}"
             style="--pa:${accentFor(p.id)}; left:${P(p).x}%; top:${P(p).y}%">
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
      ${state.collections.filter((c) => !isArchived("collection", c.id)).map((c) => `
        <div class="collection" data-collection="${c.id}" style="left:${P(c).x}%; top:${P(c).y}%">
          <div class="collection-tile">${collectionPreview(c)}</div>
          <div class="icon-label">${escapeHtml(c.name)}</div>
        </div>`).join("")}
      <div class="widget" data-people style="left:${peoplePosActive().x}%; top:${peoplePosActive().y}%; --wt:#f472b6">
        <div class="widget-tile">${ICONS.users}
          ${(() => {
            const pending = state.people.filter((per) =>
              tasksForPerson(per.id).some((x) => !x.task.done)).length;
            return pending ? `<span class="widget-badge">${pending}</span>` : "";
          })()}
        </div>
        <div class="icon-label">People</div>
      </div>
      ${state.links.filter((l) => onDesktop("link", l.id)).map((l) => `
        <div class="linkicon" data-link="${l.id}" style="left:${P(l).x}%; top:${P(l).y}%">
          <div class="linkicon-tile">
            <img src="${linkIconSrc(l.url)}"
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
        <div class="dock-sep"></div>
        <button class="dock-btn" data-tip="Archive" data-archive>${ICONS.archive}
          ${state.archived.length ? `<span class="archive-count">${state.archived.length}</span>` : ""}
        </button>
      </div>
    </div>
    ${widgetKind ? widgetWindowHtml(widgetKind) : ""}
    ${collectionId ? collectionHtml(collectionId) : ""}
    ${archiveOpen ? archiveHtml() : ""}
  `;

  wireDesktop();
  if (widgetKind) wireWidgetWindow(widgetKind);
  if (collectionId) wireCollection(collectionId);
  if (archiveOpen) wireArchive();
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
  app.querySelector("[data-dock-tidy]").addEventListener("click", () => {
    if (IS_MOBILE) {
      // phones have their own layout — tidy only touches the mobile grid
      mobileTidy();
      renderDesktop(null);
      return;
    }
    // compact grid computed in PIXELS from the real window size, then stored
    // as % — so icons never overlap on small screens and stay compact on big ones
    const rect = app.querySelector("[data-items]").getBoundingClientRect();
    const stepXpx = 136, stepYpx = 132;   // icon footprint incl. label + breathing room
    const startXpx = 36, startYpx = 28;
    const widgetColPx = 150;              // reserved column on the right for widgets
    const perRow = Math.max(2, Math.floor((rect.width - widgetColPx - startXpx) / stepXpx));

    const gridPos = (n) => ({
      x: Math.min(96, ((startXpx + (n % perRow) * stepXpx) / rect.width) * 100),
      y: Math.min(88, ((startYpx + Math.floor(n / perRow) * stepYpx) / rect.height) * 100),
    });

    // only what's actually visible on the desktop gets a slot — no gaps
    let n = 0;
    state.projects.filter((p) => onDesktop("project", p.id)).forEach((p) => (p.pos = gridPos(n++)));
    n = Math.ceil(n / perRow) * perRow; // links start on a fresh row
    state.links.filter((l) => onDesktop("link", l.id)).forEach((l) => (l.pos = gridPos(n++)));
    n = Math.ceil(n / perRow) * perRow; // collections on their own row below
    state.collections.filter((c) => !isArchived("collection", c.id)).forEach((c) => (c.pos = gridPos(n++)));

    const widgetX = ((rect.width - 120) / rect.width) * 100;
    Object.keys(WIDGETS).forEach((k, i) => {
      state.widgets[k] = {
        x: widgetX,
        y: Math.min(88, ((startYpx + i * stepYpx) / rect.height) * 100),
      };
    });
    state.peoplePos = {
      x: widgetX,
      y: Math.min(88, ((startYpx + Object.keys(WIDGETS).length * stepYpx) / rect.height) * 100),
    };
    persist();
    renderDesktop(null);
  });

  /* dropping one icon onto another groups them into a collection (iOS-style);
     dropping onto an existing collection adds to it */
  function dropGroup(targetEl, type, id) {
    // anything dropped on the archive box gets archived
    if (targetEl.dataset.archive !== undefined) {
      state.archived.push({ type, id });
      persist();
      renderDesktop(null);
      return true;
    }
    // collections themselves can only be archived, not nested
    if (type === "collection") return false;

    if (targetEl.dataset.collection) {
      const c = state.collections.find((x) => x.id === targetEl.dataset.collection);
      c.items.push({ type, id });
    } else {
      const tType = targetEl.dataset.icon ? "project" : "link";
      const tId = targetEl.dataset.icon || targetEl.dataset.link;
      if (tType === type && tId === id) return false;
      const tPos = tType === "project"
        ? P(getProject(tId))
        : P(state.links.find((l) => l.id === tId));
      const c = {
        id: uid(),
        name: "Collection",
        pos: { ...tPos },
        items: [{ type: tType, id: tId }, { type, id }],
      };
      state.collections.push(c);
      persist();
      // open it right away so the user can name their new collection (iOS-style)
      window.location.hash = "#/c/" + c.id;
      return true;
    }
    persist();
    renderDesktop(null);
    return true;
  }

  /* shared drag behavior for desktop objects */
  function draggable(el, pos, { onOpen, groupType, groupId }) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);

      const rect = layer.getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY;
      const origX = pos.x, origY = pos.y;
      let dragged = false;
      let lastX = e.clientX, lastY = e.clientY;
      let hoverTarget = null; // potential drop target under the pointer

      function findTarget(x, y) {
        const stack = document.elementsFromPoint(x, y);
        const under = stack.find((node) => !el.contains(node) && node !== el);
        const t = under && under.closest("[data-icon],[data-link],[data-collection],[data-archive]");
        return t && t !== el ? t : null;
      }

      function setHover(t) {
        if (t === hoverTarget) return;
        if (hoverTarget) hoverTarget.classList.remove("drop-target");
        hoverTarget = t;
        if (hoverTarget) hoverTarget.classList.add("drop-target");
      }

      function onMove(ev) {
        lastX = ev.clientX; lastY = ev.clientY;
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
          // light up whatever we'd merge into if released here
          if (groupType) setHover(findTarget(ev.clientX, ev.clientY));
        }
      }

      function onUp() {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);

        setHover(null);
        el.classList.remove("dragging");

        if (!dragged) { onOpen(); return; }

        // dropped on another icon/collection?
        if (groupType) {
          const target = findTarget(lastX, lastY);
          if (target && dropGroup(target, groupType, groupId)) return;
        }
        persist(); // just a move
      }

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    });
  }

  // project icons
  app.querySelectorAll("[data-icon]").forEach((el) => {
    const id = el.dataset.icon;
    draggable(el, P(getProject(id)), {
      onOpen: () => (window.location.hash = "#/p/" + id),
      groupType: "project",
      groupId: id,
    });
  });

  // collections (draggable; can be dropped onto the archive)
  app.querySelectorAll("[data-collection]").forEach((el) => {
    const c = state.collections.find((x) => x.id === el.dataset.collection);
    draggable(el, P(c), {
      onOpen: () => (window.location.hash = "#/c/" + c.id),
      groupType: "collection",
      groupId: c.id,
    });
  });

  // archive lives in the dock: click opens it, dragging icons onto it archives them
  const archiveEl = app.querySelector("[data-archive]");
  if (archiveEl) archiveEl.addEventListener("click", () => (window.location.hash = "#/a"));

  // people object: drag to move, click to open the network page
  const peopleEl = app.querySelector("[data-people]");
  if (peopleEl) draggable(peopleEl, peoplePosActive(), {
    onOpen: () => (window.location.hash = "#/people"),
  });

  // web links: drag to move (or group), click to confirm & open
  app.querySelectorAll("[data-link]").forEach((el) => {
    const link = state.links.find((l) => l.id === el.dataset.link);
    draggable(el, P(link), {
      onOpen: () => showOpenLinkModal(link),
      groupType: "link",
      groupId: link.id,
    });
  });

  // floating widgets: drag to move, click to open
  app.querySelectorAll("[data-widget]").forEach((el) => {
    const kind = el.dataset.widget;
    draggable(el, widgetPos(kind), {
      onOpen: () => (window.location.hash = "#/w/" + kind),
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
          <span class="choice-desc">Goals, tasks & notes</span>
        </button>
        <button class="choice-card" id="ch-link">
          ${ICONS.link}
          <span class="choice-name">Link</span>
          <span class="choice-desc">Shortcut to a website</span>
        </button>
        <button class="choice-card" id="ch-collection">
          ${ICONS.shuffle}
          <span class="choice-name">Collection</span>
          <span class="choice-desc">Group projects & links</span>
        </button>
      </div>
    </div>
  `;
  app.appendChild(backdrop);

  function close() { backdrop.remove(); }

  backdrop.querySelector("#ch-project").addEventListener("click", () => { close(); showNewProjectModal(); });
  backdrop.querySelector("#ch-link").addEventListener("click", () => { close(); showNewLinkModal(); });
  backdrop.querySelector("#ch-collection").addEventListener("click", () => {
    close();
    showCollectionComposer(null);
  });
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

/* "Do you want to open this?" confirmation (may stack over a collection panel) */
function showOpenLinkModal(link) {
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
      state.collections.forEach((c) => {
        c.items = c.items.filter((i) => !(i.type === "link" && i.id === link.id));
      });
      state.archived = state.archived.filter((a) => !(a.type === "link" && a.id === link.id));
      persist();
      close();
      route();
    }
  });
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
    if (e.key === "Enter") { window.open(link.url, "_blank", "noopener"); close(); }
  });
  backdrop.querySelector("#ol-open").focus();
}

/* ---------- collection composer (create / add items) ---------- */

/* everything still sitting loose on the desktop */
function availableItems() {
  return [
    ...state.projects.filter((p) => onDesktop("project", p.id))
      .map((p) => ({ type: "project", id: p.id })),
    ...state.links.filter((l) => onDesktop("link", l.id))
      .map((l) => ({ type: "link", id: l.id })),
  ];
}

/* list-row thumbnail + labels for an item reference */
function rowThumb(it) {
  if (it.type === "project") {
    const p = getProject(it.id);
    if (!p) return null;
    return {
      name: p.name,
      kind: "Project",
      thumb: `<span class="crow-thumb" style="--pa:${accentFor(p.id)}">${initials(p.name)}</span>`,
    };
  }
  if (it.type === "collection") {
    const c = state.collections.find((x) => x.id === it.id);
    if (!c) return null;
    return {
      name: c.name,
      kind: "Collection",
      thumb: `<span class="crow-thumb crow-collthumb">${ICONS.shuffle}</span>`,
    };
  }
  const l = state.links.find((x) => x.id === it.id);
  if (!l) return null;
  return {
    name: l.name,
    kind: "Link",
    thumb: `<span class="crow-thumb crow-linkthumb"><img src="${linkIconSrc(l.url)}" alt="" onerror="this.style.display='none'" /></span>`,
  };
}

/* ---------- full-page note for a task/goal ---------- */

function renderNotePage(pid, kind, itemId) {
  const p = getProject(pid);
  const item = p[kind].find((i) => i.id === itemId);
  const accent = accentFor(pid);

  app.innerHTML = `
    <div class="notepage" style="--pa:${accent}">
      <div class="notepage-bar">
        <button class="back-btn" data-back>&larr; ${escapeHtml(p.name)}</button>
        <div class="note-tools">
          <button class="tool-btn" data-cmd="h2" title="Heading">H</button>
          <button class="tool-btn" data-cmd="ul" title="Bullet list">&bull; List</button>
          <button class="tool-btn" data-cmd="p" title="Plain text">Text</button>
        </div>
        <span class="save-hint" id="note-hint">&nbsp;</span>
      </div>
      <div class="notepage-inner">
        <input class="note-title" id="note-title" value="${escapeHtml(item.text)}" maxlength="200" />
        <div class="note-editor" id="note-editor" contenteditable="true"></div>
      </div>
    </div>
  `;

  const editor = document.getElementById("note-editor");
  editor.innerHTML = item.note || "";

  function back() { window.location.hash = "#/p/" + pid; }
  app.querySelector("[data-back]").addEventListener("click", back);
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { back(); document.removeEventListener("keydown", esc); }
  });

  // the page title IS the task text
  const titleInput = document.getElementById("note-title");
  titleInput.addEventListener("blur", () => {
    const v = titleInput.value.trim();
    if (v) item.text = v;
    persist();
  });
  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); editor.focus(); }
  });

  // formatting toolbar
  app.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      editor.focus();
      const cmd = btn.dataset.cmd;
      if (cmd === "h2") document.execCommand("formatBlock", false, "<h2>");
      else if (cmd === "ul") document.execCommand("insertUnorderedList");
      else document.execCommand("formatBlock", false, "<p>");
    });
  });

  // autosave (debounced)
  const hint = document.getElementById("note-hint");
  let timer = null;
  editor.addEventListener("input", () => {
    clearTimeout(timer);
    hint.textContent = "typing…";
    timer = setTimeout(() => {
      item.note = editor.textContent.trim() ? editor.innerHTML : "";
      persist();
      hint.textContent = "saved";
      setTimeout(() => (hint.innerHTML = "&nbsp;"), 1500);
    }, 500);
  });
}

/* ---------- people network page ---------- */

let selectedPersonId = null;

function renderPeoplePage() {
  const ppl = state.people;
  const me = state.mePos;

  // anyone without a saved position gets an orbital starting spot
  let seeded = false;
  ppl.forEach((per, i) => {
    if (!per.pos) {
      const a = (i / ppl.length) * Math.PI * 2 - Math.PI / 2;
      per.pos = { x: 50 + 34 * Math.cos(a), y: 47 + 32 * Math.sin(a) };
      seeded = true;
    }
  });
  if (seeded) persist();

  const meLines = ppl.map((per) => `
    <line x1="${me.x}" y1="${me.y}" x2="${per.pos.x}" y2="${per.pos.y}"
      data-line="${per.id}"
      class="pline ${selectedPersonId === per.id ? "active" : ""}"
      vector-effect="non-scaling-stroke" />`).join("");

  const edgeLines = state.peopleEdges.map((e) => {
    const a = personById(e.a), b = personById(e.b);
    if (!a || !b) return "";
    return `
      <line x1="${a.pos.x}" y1="${a.pos.y}" x2="${b.pos.x}" y2="${b.pos.y}"
        data-edge data-a="${e.a}" data-b="${e.b}"
        class="pedge" vector-effect="non-scaling-stroke" />`;
  }).join("");

  const nodeHtml = ppl.map((per) => {
    const open = tasksForPerson(per.id).filter((x) => !x.task.done).length;
    return `
      <div class="pnode ${selectedPersonId === per.id ? "selected" : ""}"
           data-person="${per.id}" style="left:${per.pos.x}%; top:${per.pos.y}%; --pc:${per.color}">
        <div class="pnode-disc">${initials(per.name)}
          ${open ? `<span class="pnode-badge">${open}</span>` : ""}
        </div>
        <div class="pnode-name">${escapeHtml(per.name)}</div>
      </div>`;
  }).join("");

  app.innerHTML = `
    <div class="peoplepage">
      <div class="notepage-bar">
        <button class="back-btn" data-back>&larr; Desktop</button>
        <div class="peoplepage-title">People</div>
        <button class="btn btn-ghost btn-sm" data-addperson>+ Add person</button>
      </div>
      <div class="people-map" data-map>
        ${ppl.length ? `
          <svg class="people-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${meLines}${edgeLines}</svg>
          ${nodeHtml}
          <div class="pnode pnode-me" data-me style="left:${me.x}%; top:${me.y}%">
            <div class="pnode-disc me-disc">N</div>
          </div>
        ` : `
          <div class="people-empty">
            <h3>No people yet</h3>
            <p>Add the people in your orbit, then connect them to tasks from the task editor.</p>
            <button class="btn btn-primary" data-addperson-2>+ Add person</button>
          </div>`}
      </div>
      ${selectedPersonId && personById(selectedPersonId) ? personPanelHtml(selectedPersonId) : ""}
    </div>
  `;

  wirePeoplePage();
}

/* while a node moves, every line touching it follows */
function updateLinesFor(pid, x, y) {
  const meLine = app.querySelector(`.pline[data-line="${pid}"]`);
  if (meLine) { meLine.setAttribute("x2", x); meLine.setAttribute("y2", y); }
  app.querySelectorAll(`[data-edge]`).forEach((el) => {
    if (el.dataset.a === pid) { el.setAttribute("x1", x); el.setAttribute("y1", y); }
    if (el.dataset.b === pid) { el.setAttribute("x2", x); el.setAttribute("y2", y); }
  });
}

/* drag behavior for map nodes (people + the center) */
function mapDraggable(el, pos, { onClick, onMove }) {
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const map = app.querySelector("[data-map]");
    const rect = map.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const origX = pos.x, origY = pos.y;
    let dragged = false;

    function move(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragged && Math.hypot(dx, dy) > 5) {
        dragged = true;
        el.classList.add("dragging");
      }
      if (dragged) {
        pos.x = Math.min(95, Math.max(5, origX + (dx / rect.width) * 100));
        pos.y = Math.min(90, Math.max(8, origY + (dy / rect.height) * 100));
        el.style.left = pos.x + "%";
        el.style.top = pos.y + "%";
        onMove(pos.x, pos.y);
      }
    }

    function up() {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.classList.remove("dragging");
      if (dragged) persist();
      else if (onClick) onClick();
    }

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  });
}

function personPanelHtml(pid) {
  const per = personById(pid);
  const connected = tasksForPerson(pid);
  const pending = connected.filter((x) => !x.task.done);
  const done = connected.filter((x) => x.task.done);

  const row = ({ task, project }) => `
    <li class="item ${task.done ? "done" : ""}" style="--pa:${accentFor(project.id)}">
      <button class="item-check" data-ptoggle="${task.id}" title="Toggle">${CHECK_SVG}</button>
      <span class="item-text">${escapeHtml(task.text)}</span>
      <button class="project-chip" data-goto="${project.id}">${escapeHtml(project.name)}</button>
    </li>`;

  return `
    <div class="person-panel">
      <button class="panel-close" data-panel-close title="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="person-head">
        <span class="pchip pchip-lg" style="--pc:${per.color}">${escapeHtml(per.name.charAt(0).toUpperCase())}</span>
        <input class="person-name" id="pp-name" value="${escapeHtml(per.name)}" maxlength="60" />
      </div>
      <textarea class="person-desc" id="pp-desc" rows="2"
        placeholder="Who is this? Add a short description...">${escapeHtml(per.desc || "")}</textarea>

      <div class="section-title" style="margin-top:14px;">Connections</div>
      <div class="editor-people person-conns">
        ${connectedIds(pid).map((oid) => {
          const o = personById(oid);
          return o ? `
            <button class="people-pick" data-selperson="${o.id}" style="--pc:${o.color}">
              <span class="pchip" style="--pc:${o.color}">${escapeHtml(o.name.charAt(0).toUpperCase())}</span>${escapeHtml(o.name)}
            </button>` : "";
        }).join("")}
        <button class="people-pick" data-add-conn>+ Connect</button>
      </div>

      <div class="section-title" style="margin-top:16px;">Connected tasks
        <span class="section-count">${connected.length ? `${done.length} / ${connected.length}` : ""}</span>
      </div>
      ${connected.length
        ? `<ul class="item-list person-tasks">${pending.map(row).join("")}${done.map(row).join("")}</ul>`
        : `<div class="empty-hint">No tasks yet — open a task's editor and tap ${escapeHtml(per.name)} to connect one.</div>`}

      <div class="person-foot">
        <button class="btn btn-danger btn-sm" data-person-delete>Remove person</button>
      </div>
    </div>
  `;
}

/* select / deselect a person WITHOUT rebuilding the page — no flash */
function selectPerson(pid) {
  selectedPersonId = pid;

  app.querySelectorAll(".pnode[data-person]").forEach((el) =>
    el.classList.toggle("selected", el.dataset.person === pid)
  );
  app.querySelectorAll(".pline").forEach((el) =>
    el.classList.toggle("active", el.dataset.line === pid)
  );

  const old = app.querySelector(".person-panel");
  if (old) old.remove();
  if (pid && personById(pid)) {
    app.querySelector(".peoplepage").appendChild(elFromHtml(personPanelHtml(pid)));
    wirePersonPanel();
  }
}

/* update one node's badge/name in place after edits */
function refreshNode(pid) {
  const per = personById(pid);
  const node = app.querySelector(`.pnode[data-person="${pid}"]`);
  if (!per || !node) return;
  const open = tasksForPerson(pid).filter((x) => !x.task.done).length;
  node.querySelector(".pnode-disc").innerHTML =
    `${initials(per.name)}${open ? `<span class="pnode-badge">${open}</span>` : ""}`;
  node.querySelector(".pnode-name").textContent = per.name;
}

function wirePeoplePage() {
  app.querySelector("[data-back]").addEventListener("click", () => {
    selectedPersonId = null;
    window.location.hash = "#/";
  });
  document.addEventListener("keydown", function esc(e) {
    if (!app.querySelector(".peoplepage")) { document.removeEventListener("keydown", esc); return; }
    if (e.key === "Escape") {
      if (selectedPersonId) selectPerson(null);
      else { document.removeEventListener("keydown", esc); window.location.hash = "#/"; }
    }
  });

  // add person
  app.querySelectorAll("[data-addperson], [data-addperson-2]").forEach((b) =>
    b.addEventListener("click", showAddPersonModal)
  );

  // nodes: drag freely around the canvas; a plain click opens the panel
  app.querySelectorAll(".pnode[data-person]").forEach((el) => {
    const per = personById(el.dataset.person);
    mapDraggable(el, per.pos, {
      onClick: () => selectPerson(per.id),
      onMove: (x, y) => updateLinesFor(per.id, x, y),
    });
  });

  // the center node moves too — all its lines follow
  const meEl = app.querySelector("[data-me]");
  if (meEl) mapDraggable(meEl, state.mePos, {
    onMove: (x, y) => {
      app.querySelectorAll(".pline").forEach((l) => {
        l.setAttribute("x1", x);
        l.setAttribute("y1", y);
      });
    },
  });

  // click empty map → clear selection
  const map = app.querySelector("[data-map]");
  map.addEventListener("pointerdown", (e) => {
    if ((e.target === map || e.target.classList.contains("people-lines")) && selectedPersonId) {
      selectPerson(null);
    }
  });

  if (selectedPersonId && personById(selectedPersonId)) wirePersonPanel();
}

function wirePersonPanel() {
  const panel = app.querySelector(".person-panel");
  if (!panel) return;
  const per = personById(selectedPersonId);
  const pid = per.id;

  panel.querySelector("[data-panel-close]").addEventListener("click", () => selectPerson(null));

  const nameInput = panel.querySelector("#pp-name");
  nameInput.addEventListener("blur", () => {
    per.name = nameInput.value.trim() || per.name;
    persist();
    refreshNode(pid); // just the node, not the page
  });
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nameInput.blur(); });

  const descInput = panel.querySelector("#pp-desc");
  descInput.addEventListener("blur", () => {
    per.desc = descInput.value.trim();
    persist();
  });

  // seamless task toggles inside the panel
  panel.querySelectorAll("[data-ptoggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const taskId = btn.dataset.ptoggle;
      state.projects.forEach((p) => {
        const t = p.tasks.find((x) => x.id === taskId);
        if (t) {
          t.done = !t.done;
          btn.closest(".item").classList.toggle("done", t.done);
        }
      });
      persist();
      refreshNode(pid); // badge count follows along
    });
  });

  panel.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedPersonId = null;
      window.location.hash = "#/p/" + btn.dataset.goto;
    });
  });

  // person↔person connections
  panel.querySelectorAll("[data-selperson]").forEach((btn) => {
    btn.addEventListener("click", () => selectPerson(btn.dataset.selperson));
  });
  panel.querySelector("[data-add-conn]").addEventListener("click", () => {
    showPeoplePickerModal(new Set(connectedIds(pid)), (picked) => {
      setConnections(pid, [...picked]);
      persist();
      renderPeoplePage(); // edges changed — redraw the map
    }, pid);
  });

  panel.querySelector("[data-person-delete]").addEventListener("click", () => {
    if (confirm(`Remove "${per.name}"? Their task connections will be cleared.`)) {
      state.people = state.people.filter((x) => x.id !== per.id);
      state.peopleEdges = state.peopleEdges.filter((e) => e.a !== per.id && e.b !== per.id);
      state.projects.forEach((p) =>
        p.tasks.forEach((t) => {
          if (t.people) {
            t.people = t.people.filter((x) => x !== per.id);
            if (!t.people.length) delete t.people;
          }
        })
      );
      selectedPersonId = null;
      persist();
      renderPeoplePage(); // structural: the whole orbit re-arranges
    }
  });
}

/* modal for connecting people — pick existing OR create someone new right here */
function showPeoplePickerModal(selectedSet, onDone, excludeId) {
  const backdrop = document.createElement("div");
  backdrop.className = "window-backdrop";
  const temp = new Set(selectedSet);
  const pickable = state.people.filter((p) => p.id !== excludeId);

  const rowHtml = (per) => `
    <button class="crow pick-row ${temp.has(per.id) ? "selected" : ""}" data-pick="${per.id}">
      <span class="pchip" style="--pc:${per.color}">${escapeHtml(per.name.charAt(0).toUpperCase())}</span>
      <span class="crow-name">${escapeHtml(per.name)}</span>
      <span class="pick-circle">${CHECK_SVG}</span>
    </button>`;

  backdrop.innerHTML = `
    <div class="collection-panel">
      <div class="picker-heading">Connect people</div>
      <div class="collection-list" data-pk-list>
        ${pickable.map(rowHtml).join("")}
        ${pickable.length ? "" : `<div class="empty-hint picker-empty" data-pk-empty>No one yet — add someone below.</div>`}
      </div>
      <div class="picker-newperson">
        <input type="text" id="pk-newname" placeholder="Or add someone new…" maxlength="60" />
        <button class="btn btn-ghost btn-sm" data-pk-new>Add</button>
      </div>
      <div class="picker-actions">
        <button class="btn btn-ghost" data-pk-cancel>Cancel</button>
        <button class="btn btn-primary" data-pk-done>Done</button>
      </div>
    </div>
  `;
  app.appendChild(backdrop);

  const listEl = backdrop.querySelector("[data-pk-list]");
  const newInput = backdrop.querySelector("#pk-newname");

  function close() { backdrop.remove(); }

  function wireRow(el) {
    el.addEventListener("click", () => {
      const pid = el.dataset.pick;
      if (temp.has(pid)) temp.delete(pid);
      else temp.add(pid);
      el.classList.toggle("selected", temp.has(pid));
    });
  }
  backdrop.querySelectorAll("[data-pick]").forEach(wireRow);

  // create a new person inline — instantly selected
  function addNew() {
    const name = newInput.value.trim();
    if (!name) { newInput.focus(); return; }
    const per = {
      id: uid(),
      name,
      desc: "",
      color: PEOPLE_COLORS[state.people.length % PEOPLE_COLORS.length],
    };
    state.people.push(per);
    persist();
    temp.add(per.id);
    const empty = backdrop.querySelector("[data-pk-empty]");
    if (empty) empty.remove();
    const row = elFromHtml(rowHtml(per));
    listEl.appendChild(row);
    wireRow(row);
    newInput.value = "";
    newInput.focus();
  }

  backdrop.querySelector("[data-pk-new]").addEventListener("click", addNew);
  newInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.stopPropagation(); addNew(); }
  });

  backdrop.querySelector("[data-pk-done]").addEventListener("click", () => { onDone(temp); close(); });
  backdrop.querySelector("[data-pk-cancel]").addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => {
    e.stopPropagation(); // don't leak Enter/Esc into the task editor behind
    if (e.key === "Escape") close();
    if (e.key === "Enter" && e.target !== newInput) { onDone(temp); close(); }
  });
}

function showAddPersonModal() {
  if (app.querySelector(".window-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "window-backdrop";
  backdrop.innerHTML = `
    <div class="new-form">
      <h3>Add person</h3>
      <input type="text" id="np-pname" placeholder="Name" maxlength="60" />
      <input type="text" id="np-pdesc" placeholder="Who are they? (optional)" maxlength="140" />
      <div class="row">
        <button class="btn btn-ghost" id="np-pcancel">Cancel</button>
        <button class="btn btn-primary" id="np-pcreate">Add</button>
      </div>
    </div>
  `;
  app.appendChild(backdrop);

  const nameInput = backdrop.querySelector("#np-pname");
  nameInput.focus();

  function close() { backdrop.remove(); }

  function create() {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const per = {
      id: uid(),
      name,
      desc: backdrop.querySelector("#np-pdesc").value.trim(),
      color: PEOPLE_COLORS[state.people.length % PEOPLE_COLORS.length],
    };
    state.people.push(per);
    selectedPersonId = per.id;
    persist();
    close();
    renderPeoplePage();
  }

  backdrop.querySelector("#np-pcreate").addEventListener("click", create);
  backdrop.querySelector("#np-pcancel").addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Enter") create();
    if (e.key === "Escape") close();
  });
}

/* ---------- archive panel ---------- */

function archiveHtml() {
  const rows = state.archived.map((it, idx) => {
    const t = rowThumb(it);
    if (!t) return "";
    return `
      <div class="crow crow-static">
        ${t.thumb}
        <span class="crow-name">${escapeHtml(t.name)}</span>
        <span class="crow-kind">${t.kind}</span>
        <button class="btn btn-ghost btn-sm" data-restore="${idx}">Restore</button>
      </div>`;
  }).join("");

  return `
    <div class="window-backdrop" data-backdrop>
      <div class="collection-panel">
        <button class="panel-close" data-panel-close title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <div class="picker-heading">Archive</div>
        <div class="collection-list">
          ${rows || `<div class="empty-hint picker-empty">Nothing archived. Drag any project, link, or collection onto the archive box.</div>`}
        </div>
      </div>
    </div>
  `;
}

function wireArchive() {
  const backdrop = app.querySelector("[data-backdrop]");

  function close() { window.location.hash = "#/"; }
  backdrop.querySelector("[data-panel-close]").addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });

  backdrop.querySelectorAll("[data-restore]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.archived.splice(+btn.dataset.restore, 1);
      persist();
      renderDesktop(null, null, null, true);
    });
  });
}

/* one visual modal for both flows:
   existing == null  → name a new collection + pick its contents
   existing == coll  → pick items to add to it */
function showCollectionComposer(existing) {
  const avail = availableItems();
  const selected = new Set();

  const backdrop = document.createElement("div");
  backdrop.className = "window-backdrop";

  const gridHtml = avail.length
    ? `<div class="collection-list picker-list">
        ${avail.map((it, i) => {
          const t = rowThumb(it);
          return `
            <button class="crow pick-row" data-pick="${i}">
              ${t.thumb}
              <span class="crow-name">${escapeHtml(t.name)}</span>
              <span class="crow-kind">${t.kind}</span>
              <span class="pick-circle">${CHECK_SVG}</span>
            </button>`;
        }).join("")}
      </div>`
    : `<div class="empty-hint picker-empty">Your desktop has nothing left to add.</div>`;

  backdrop.innerHTML = `
    <div class="collection-panel">
      ${existing
        ? `<div class="picker-heading">Add to “${escapeHtml(existing.name)}”</div>`
        : `<input type="text" id="nc-name" placeholder="Collection name" maxlength="40" />`}
      ${avail.length ? `<div class="picker-sub">Tap to choose what goes inside</div>` : ""}
      ${gridHtml}
      <div class="picker-actions">
        <button class="btn btn-ghost" data-pk-cancel>Cancel</button>
        <button class="btn btn-primary" data-pk-done>${existing ? "Add" : "Create"}</button>
      </div>
    </div>
  `;
  app.appendChild(backdrop);

  const doneBtn = backdrop.querySelector("[data-pk-done]");
  const nameInput = backdrop.querySelector("#nc-name");
  if (nameInput) nameInput.focus();

  function refreshDone() {
    const n = selected.size;
    if (existing) {
      doneBtn.disabled = n === 0;
      doneBtn.textContent = n ? `Add ${n} item${n > 1 ? "s" : ""}` : "Add";
    } else {
      doneBtn.textContent = n ? `Create with ${n} item${n > 1 ? "s" : ""}` : "Create";
    }
  }
  refreshDone();

  backdrop.querySelectorAll("[data-pick]").forEach((el) => {
    el.addEventListener("click", () => {
      const i = +el.dataset.pick;
      if (selected.has(i)) { selected.delete(i); el.classList.remove("selected"); }
      else { selected.add(i); el.classList.add("selected"); }
      refreshDone();
    });
  });

  function close() { backdrop.remove(); }

  function done() {
    const items = [...selected].map((i) => avail[i]);
    if (existing) {
      if (!items.length) return;
      existing.items.push(...items);
      persist();
      close();
      renderDesktop(null, null, existing.id);
    } else {
      const c = {
        id: uid(),
        name: (nameInput.value.trim() || "Collection"),
        pos: defaultPos(state.collections.length + 5),
        items,
      };
      state.collections.push(c);
      persist();
      close();
      renderDesktop(null);
    }
  }

  doneBtn.addEventListener("click", done);
  backdrop.querySelector("[data-pk-cancel]").addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
    if (e.key === "Enter" && e.target === nameInput) done();
  });
}

/* ---------- collection panel (iOS folder expand) ---------- */

function collectionHtml(id) {
  const c = state.collections.find((x) => x.id === id);

  const cells = c.items.map((it, idx) => {
    const t = rowThumb(it);
    if (!t) return "";
    return `
      <div class="crow" data-citem="${idx}">
        ${t.thumb}
        <span class="crow-name">${escapeHtml(t.name)}</span>
        <span class="crow-kind">${t.kind}</span>
        <button class="crow-remove" data-cremove="${idx}" data-tip="Remove from collection">&times;</button>
      </div>`;
  }).join("");

  // "+ Add items" row opens the visual picker (only if there's anything to add)
  const addTile = availableItems().length
    ? `<button class="crow crow-add" data-cadd-open>+ Add items</button>`
    : "";

  return `
    <div class="window-backdrop" data-backdrop>
      <div class="collection-panel">
        <button class="panel-close" data-panel-close title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <input class="collection-title" id="col-name" value="${escapeHtml(c.name)}" maxlength="40" />
        <div class="collection-list">
          ${cells}${addTile}
          ${!cells && !addTile ? `<div class="empty-hint picker-empty">This collection is empty.</div>` : ""}
        </div>
        <div class="collection-footer">
          <button class="btn btn-ghost" id="col-archive">Archive</button>
          <button class="btn btn-danger" id="col-delete">Delete collection</button>
        </div>
      </div>
    </div>
  `;
}

function wireCollection(id) {
  const c = state.collections.find((x) => x.id === id);
  const backdrop = app.querySelector("[data-backdrop]");

  function close() { window.location.hash = "#/"; }
  backdrop.querySelector("[data-panel-close]").addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });

  // rename — and if it's a freshly drag-created collection, invite the rename
  const nameInput = backdrop.querySelector("#col-name");
  nameInput.addEventListener("blur", () => {
    c.name = nameInput.value.trim() || c.name;
    persist();
  });
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nameInput.blur(); });
  if (c.name === "Collection") { nameInput.focus(); nameInput.select(); }

  // open items / remove items
  backdrop.querySelectorAll("[data-citem]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-cremove]")) return;
      const it = c.items[+el.dataset.citem];
      if (it.type === "project") {
        window.location.hash = "#/p/" + it.id;
      } else {
        const l = state.links.find((x) => x.id === it.id);
        if (l) showOpenLinkModal(l);
      }
    });
  });
  backdrop.querySelectorAll("[data-cremove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      c.items.splice(+btn.dataset.cremove, 1);
      persist();
      renderDesktop(null, null, id);
    });
  });

  // "+" tile → visual picker for adding more items
  const addOpen = backdrop.querySelector("[data-cadd-open]");
  if (addOpen) addOpen.addEventListener("click", () => showCollectionComposer(c));

  // archive the whole collection
  backdrop.querySelector("#col-archive").addEventListener("click", () => {
    state.archived.push({ type: "collection", id });
    persist();
    close();
  });

  // delete the collection; its contents return to the desktop
  backdrop.querySelector("#col-delete").addEventListener("click", () => {
    if (confirm(`Delete "${c.name}"? Its contents go back to the desktop.`)) {
      state.collections = state.collections.filter((x) => x.id !== id);
      state.archived = state.archived.filter((a) => !(a.type === "collection" && a.id === id));
      persist();
      close();
    }
  });
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
      let toggled = null;
      state.projects.forEach((p) => {
        const t = p[source].find((x) => x.id === taskId);
        if (t) { t.done = !t.done; toggled = t; }
      });
      persist();
      if (toggled) btn.closest(".item").classList.toggle("done", toggled.done);
    });
  });

  backdrop.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => (window.location.hash = "#/p/" + btn.dataset.goto));
  });
}

/* ---------- 4. PROJECT WINDOW ---------- */

/* ---------- full-screen project page with tabs ---------- */

/* old notes were plain text; new ones store HTML from the rich editor */
function noteBodyHtml(text) {
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text; // already HTML
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function noteCardHtml(n) {
  const d = new Date(n.createdAt);
  const when = isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `
    <div class="note-card" data-note="${n.id}">
      <div class="note-card-text" contenteditable="true" data-ph="Write...">${noteBodyHtml(n.text)}</div>
      <div class="note-card-foot">
        <div class="note-tools-mini">
          <button class="fmt-btn" data-cmd="bold" title="Bold"><b>B</b></button>
          <button class="fmt-btn" data-cmd="italic" title="Italic"><i>I</i></button>
          <button class="fmt-btn" data-cmd="underline" title="Underline"><u>U</u></button>
          <button class="fmt-btn" data-cmd="insertUnorderedList" title="Bullet list">&bull; List</button>
        </div>
        <span class="note-date">${when}</span>
        <button class="action-btn item-delete" data-delnote title="Delete note">&times;</button>
      </div>
    </div>`;
}

let projTab = "notes";
let projTabFor = null; // which project the remembered tab belongs to

/* content of the currently selected tab */
function projTabBodyHtml(p) {
  if (projTab === "notes") {
    return `
      <div class="doc-feed">
        <button class="crow crow-add note-add" data-add-note>+ Add a note</button>
        <div id="notes-feed">
          ${p.notesList.map((n) => noteCardHtml(n)).join("")}
        </div>
      </div>`;
  }
  if (projTab === "work") {
    return `
      ${sectionHtml("goals", "Goals", p.goals, "Add a goal...")}
      ${sectionHtml("tasks", "Tasks", p.tasks, "Add a task...")}`;
  }
  const linked = [...p.tasks, ...p.goals].filter((t) => t.link);
  const hostOf = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  };
  return `
    <div class="panel">
      <div class="section-title">Docs / Links</div>
      <div class="collection-list" style="padding-top:6px;">
        <button class="crow crow-add" data-add-plink>+ Add link</button>
        ${p.links.map((l) => `
          <a class="crow" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">
            <span class="crow-thumb crow-linkthumb"><img src="${linkIconSrc(l.url)}" alt="" onerror="this.style.display='none'" /></span>
            <span class="crow-name">${escapeHtml(l.name)}</span>
            <span class="crow-kind">${escapeHtml(hostOf(l.url))}</span>
            <button class="crow-remove" data-del-plink="${l.id}" data-tip="Remove link">&times;</button>
          </a>`).join("")}
        ${linked.map((t) => `
            <a class="crow" href="${escapeHtml(t.link)}" target="_blank" rel="noopener">
              <span class="crow-thumb crow-linkthumb"><img src="${linkIconSrc(t.link)}" alt="" onerror="this.style.display='none'" /></span>
              <span class="crow-name">${escapeHtml(t.text)}</span>
              <span class="crow-kind">${escapeHtml(hostOf(t.link))}</span>
            </a>`).join("")}
        ${linked.length || p.links.length ? "" : `<div class="empty-hint picker-empty">No links yet.</div>`}
      </div>
    </div>`;
}

const PROJ_TABS = [
  { key: "notes", label: "Notes" },
  { key: "work", label: "Goals & Tasks" },
  { key: "links", label: "Docs / Links" },
];

function renderProjectPage(id, tab) {
  const p = getProject(id);
  const accent = accentFor(id);

  if (projTabFor !== id) { projTab = "notes"; projTabFor = id; } // fresh open → Notes
  if (tab) projTab = tab;

  const body = projTabBodyHtml(p);

  const pageHtml = `
    <div class="projectpage" style="--pa:${accent}">
      <div class="notepage-bar">
        <button class="back-btn" data-back title="Back to desktop">&larr;</button>
        <input class="proj-name-bar" id="pj-name" value="${escapeHtml(p.name)}" maxlength="60" />
        <div class="proj-tabs">
          ${PROJ_TABS.map((t) => `
            <button class="proj-tab ${projTab === t.key ? "active" : ""}" data-ptab="${t.key}">${t.label}</button>
          `).join("")}
        </div>
        <div class="titlebar-actions">
          <button class="tb-action" data-tb-archive title="Archive project">${ICONS.archive}</button>
          <button class="tb-action tb-action-danger" data-tb-delete title="Delete project">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
      <div class="projectpage-inner">
        ${body}
      </div>
    </div>
  `;

  // if the desktop is already on screen, layer the page OVER it and animate in —
  // no blank frame, no flash. Otherwise (deep link/refresh) render normally.
  const desktopBehind = app.querySelector("[data-desktop]");
  const existingPage = app.querySelector(".projectpage");
  if (desktopBehind && !existingPage) {
    app.querySelectorAll(".window-backdrop, .person-panel").forEach((el) => el.remove());
    app.appendChild(elFromHtml(pageHtml));
  } else {
    app.innerHTML = pageHtml;
  }

  wireProjectPage(id);
}

function wireProjectPage(id) {
  const p = getProject(id);
  const page = app.querySelector(".projectpage");

  page.querySelector("[data-back]").addEventListener("click", () => (window.location.hash = "#/"));
  document.addEventListener("keydown", function esc(e) {
    if (!app.querySelector(".projectpage")) { document.removeEventListener("keydown", esc); return; }
    if (e.key === "Escape" && !e.target.closest("input, textarea, .item-editor")) {
      document.removeEventListener("keydown", esc);
      window.location.hash = "#/";
    }
  });

  // tabs: swap only the content area — no page rebuild, subtle slide-in
  page.querySelectorAll("[data-ptab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (projTab === btn.dataset.ptab) return;
      projTab = btn.dataset.ptab;
      page.querySelectorAll("[data-ptab]").forEach((b) =>
        b.classList.toggle("active", b.dataset.ptab === projTab)
      );
      const inner = page.querySelector(".projectpage-inner");
      inner.innerHTML = projTabBodyHtml(p);
      inner.classList.remove("tab-anim");
      void inner.offsetWidth; // restart the entrance animation
      inner.classList.add("tab-anim");
      wireTabContent(id, page);
    });
  });

  // title
  function bindField(selector, apply) {
    const el = page.querySelector(selector);
    const save = () => { apply(el.value.trim()); persist(); };
    el.addEventListener("blur", save);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && el.tagName !== "TEXTAREA") el.blur();
    });
  }
  bindField("#pj-name", (v) => { p.name = v || p.name; });

  wireTabContent(id, page);

  // archive / delete
  page.querySelector("[data-tb-archive]").addEventListener("click", () => {
    state.archived.push({ type: "project", id });
    persist();
    window.location.hash = "#/";
  });
  page.querySelector("[data-tb-delete]").addEventListener("click", () => {
    if (confirm(`Delete "${p.name}"? This cannot be undone.`)) {
      state.projects = state.projects.filter((x) => x.id !== id);
      state.collections.forEach((c) => {
        c.items = c.items.filter((i) => !(i.type === "project" && i.id === id));
      });
      state.archived = state.archived.filter((a) => !(a.type === "project" && a.id === id));
      persist();
      window.location.hash = "#/";
    }
  });
}

/* wiring for whatever tab is currently showing */
function wireTabContent(id, page) {
  const p = getProject(id);

  if (projTab === "notes") {
    const feed = page.querySelector("#notes-feed");

    function wireNoteCard(card) {
      const note = p.notesList.find((n) => n.id === card.dataset.note);
      const editor = card.querySelector(".note-card-text");

      function saveNote() {
        note.text = editor.textContent.trim() ? editor.innerHTML : "";
        persist();
      }

      let timer = null;
      editor.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(saveNote, 500);
      });
      editor.addEventListener("blur", saveNote);

      // formatting: bold / italic / underline / bullets — keep the selection alive
      card.querySelectorAll("[data-cmd]").forEach((btn) => {
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          document.execCommand(btn.dataset.cmd, false, null);
          saveNote();
        });
      });

      card.querySelector("[data-delnote]").addEventListener("click", () => {
        if (!confirm("Delete this note?")) return;
        p.notesList = p.notesList.filter((n) => n.id !== note.id);
        persist();
        card.remove(); // in place, no flash
      });
    }

    feed.querySelectorAll(".note-card").forEach(wireNoteCard);

    // "+ Add a note" → a fresh card appears at the top, ready to type
    page.querySelector("[data-add-note]").addEventListener("click", () => {
      const n = { id: uid(), text: "", createdAt: new Date().toISOString() };
      p.notesList.unshift(n);
      persist();
      const card = elFromHtml(noteCardHtml(n));
      feed.prepend(card);
      wireNoteCard(card);
      card.querySelector(".note-card-text").focus();

    });

  } else if (projTab === "work") {
    bindItemSection("goals", p.goals, id);
    bindItemSection("tasks", p.tasks, id);
  } else if (projTab === "links") {
    page.querySelector("[data-add-plink]").addEventListener("click", () => showAddProjectLinkModal(p, id, page));
    page.querySelectorAll("[data-del-plink]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("Remove this link?")) return;
        p.links = p.links.filter((x) => x.id !== btn.dataset.delPlink);
        persist();
        btn.closest(".crow").remove(); // in place
      });
    });
  }
}

/* small modal: add a link directly to the project */
function showAddProjectLinkModal(p, id, page) {
  const backdrop = document.createElement("div");
  backdrop.className = "window-backdrop";
  backdrop.innerHTML = `
    <div class="new-form">
      <h3>Add link</h3>
      <input type="text" id="pl-name" placeholder="Name" maxlength="60" />
      <input type="text" id="pl-url" placeholder="URL (e.g. figma.com/file/…)" maxlength="500" />
      <div class="row">
        <button class="btn btn-ghost" id="pl-cancel">Cancel</button>
        <button class="btn btn-primary" id="pl-add">Add</button>
      </div>
    </div>
  `;
  app.appendChild(backdrop);

  const nameInput = backdrop.querySelector("#pl-name");
  const urlInput = backdrop.querySelector("#pl-url");
  nameInput.focus();

  function close() { backdrop.remove(); }

  function add() {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    if (!url) { urlInput.focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try { new URL(url); } catch { urlInput.focus(); return; }

    let host = "";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    p.links.unshift({ id: uid(), name: name || host, url });
    persist();
    close();
    // refresh just the tab content — same seamless swap as tab switching
    const inner = page.querySelector(".projectpage-inner");
    inner.innerHTML = projTabBodyHtml(p);
    wireTabContent(id, page);
  }

  backdrop.querySelector("#pl-add").addEventListener("click", add);
  backdrop.querySelector("#pl-cancel").addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") add();
    if (e.key === "Escape") close();
  });
}

/* Builds the HTML for a checkable list panel (goals or tasks) */
function itemRowHtml(item) {
  return `
      <li class="item ${item.done ? "done" : ""}" data-id="${item.id}">
        <button class="item-check" data-toggle title="Toggle">${CHECK_SVG}</button>
        <span class="item-text" data-edit title="Click to edit">
          ${item.tag ? `<span class="item-tag" style="--wt:${WIDGETS[item.tag].tint}" title="${WIDGETS[item.tag].label}">${WIDGETS[item.tag].icon}</span>` : ""}${escapeHtml(item.text)}
        </span>
        <span class="item-badges">
          ${item.note ? `<button class="badge badge-note" data-notebtn title="Open doc">${NOTE_SVG}</button>` : ""}
          ${item.link ? `<a class="badge badge-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener" title="${escapeHtml(item.link)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></a>` : ""}
          ${personChipsHtml(item)}
        </span>
        <span class="item-actions">
          <button class="action-btn item-delete" data-delete title="Delete">&times;</button>
        </span>
      </li>`;
}

function elFromHtml(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function sectionHtml(kind, label, items, placeholder) {
  const doneCount = items.filter((i) => i.done).length;
  const rows = items.map(itemRowHtml).join("");

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

  const list = section.querySelector(".item-list");

  function updateCount() {
    const count = section.querySelector(".section-count");
    if (count) {
      const doneCount = items.filter((i) => i.done).length;
      count.textContent = items.length ? `${doneCount} / ${items.length}` : "";
    }
  }

  /* swap one row for a fresh render of itself — no page flash */
  function refreshRow(li, item) {
    const fresh = elFromHtml(itemRowHtml(item));
    li.replaceWith(fresh);
    wireItem(fresh, item);
    updateCount();
  }

  function add() {
    const text = input.value.trim();
    if (!text) return;
    const item = { id: uid(), text, done: false, tag: selectedTag };
    items.push(item);
    persist();

    // insert in place — no re-render, no flash
    const li = elFromHtml(itemRowHtml(item));
    list.appendChild(li);
    wireItem(li, item);
    updateCount();
    const hint = section.querySelector(".empty-hint");
    if (hint) hint.remove();
    input.value = "";
    input.focus();
  }

  section.querySelector("[data-add-btn]").addEventListener("click", add);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });

  /* full inline editor: text, tag (switchable), link — all in one place */
  function startEdit(li, item) {
    if (li.classList.contains("editing")) return;
    li.classList.add("editing");

    const canTag = kind === "tasks";
    let editTag = item.tag || null;
    const editPeople = new Set(item.people || []);

    li.innerHTML = `
      <div class="item-editor">
        <input class="edit-input" id="ed-text" value="${escapeHtml(item.text)}" maxlength="200" />
        <div class="editor-row">
          ${canTag ? Object.keys(WIDGETS).map((t) => `
            <button class="tag-btn ${editTag === t ? "active" : ""}" data-edtag="${t}"
              style="--wt:${WIDGETS[t].tint}" title="${WIDGETS[t].label}">${WIDGETS[t].icon}</button>
          `).join("") : ""}
          <input class="edit-input edit-link" id="ed-link" value="${escapeHtml(item.link || "")}"
            placeholder="Link (optional)" maxlength="300" />
        </div>
        <div class="editor-actions">
          ${kind === "tasks" ? `
          <button class="btn btn-ghost btn-sm editor-note-btn" data-ed-addppl>${ICONS.users} <span id="ed-ppl-label">Add people</span></button>
          <span id="ed-pchips"></span>` : ""}
          <button class="btn btn-ghost btn-sm editor-note-btn" data-ed-note>${NOTE_SVG} ${item.note ? "Open doc" : "Add doc"}</button>
          <span class="editor-spacer"></span>
          <button class="btn btn-ghost btn-sm" data-ed-cancel>Cancel</button>
          <button class="btn btn-primary btn-sm" data-ed-save>Save</button>
        </div>
      </div>
    `;

    const textInput = li.querySelector("#ed-text");
    const linkInput = li.querySelector("#ed-link");
    textInput.focus();
    textInput.select();

    // tag switcher: tap to select, tap again to clear
    li.querySelectorAll("[data-edtag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editTag = editTag === btn.dataset.edtag ? null : btn.dataset.edtag;
        li.querySelectorAll("[data-edtag]").forEach((b) =>
          b.classList.toggle("active", b.dataset.edtag === editTag)
        );
      });
    });

    // people connections: opens a proper picker modal
    const pchipsEl = li.querySelector("#ed-pchips");
    const pplLabel = li.querySelector("#ed-ppl-label");

    function renderEdChips() {
      if (!pchipsEl) return;
      pchipsEl.innerHTML = [...editPeople].map((pid) => {
        const per = personById(pid);
        return per ? `<span class="pchip" style="--pc:${per.color}" title="${escapeHtml(per.name)}">${escapeHtml(per.name.charAt(0).toUpperCase())}</span>` : "";
      }).join("");
      if (pplLabel) pplLabel.textContent = editPeople.size ? "People" : "Add people";
    }
    renderEdChips();

    const addPplBtn = li.querySelector("[data-ed-addppl]");
    if (addPplBtn) addPplBtn.addEventListener("click", () => {
      showPeoplePickerModal(editPeople, (picked) => {
        editPeople.clear();
        picked.forEach((v) => editPeople.add(v));
        renderEdChips();
      });
    });

    function applyEdits() {
      const text = textInput.value.trim();
      if (text) item.text = text;
      item.tag = editTag;
      const url = linkInput.value.trim();
      if (!url) delete item.link;
      else item.link = /^https?:\/\//i.test(url) ? url : "https://" + url;
      if (editPeople.size) item.people = [...editPeople];
      else delete item.people;
      persist();
    }

    function save() {
      applyEdits();
      refreshRow(li, item); // only this row updates
    }

    li.querySelector("[data-ed-save]").addEventListener("click", save);
    li.querySelector("[data-ed-cancel]").addEventListener("click", () => refreshRow(li, item));
    li.querySelector("[data-ed-note]").addEventListener("click", () => {
      applyEdits(); // keep whatever was typed, then jump into the doc
      window.location.hash = `#/n/${projectId}/${kind}/${item.id}`;
    });
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
      if (e.key === "Escape") refreshRow(li, item);
    });
  }

  function wireItem(li, item) {
    // completing is seamless: no re-render, just animate the state in place
    li.querySelector("[data-toggle]").addEventListener("click", () => {
      item.done = !item.done;
      persist();
      li.classList.toggle("done", item.done);
      updateCount();
    });
    li.querySelector("[data-delete]").addEventListener("click", () => {
      const idx = items.findIndex((i) => i.id === item.id);
      items.splice(idx, 1);
      persist();
      li.remove(); // in place, no flash
      updateCount();
    });
    li.querySelector("[data-edit]").addEventListener("click", () => startEdit(li, item));
    li.querySelectorAll("[data-notebtn]").forEach((b) =>
      b.addEventListener("click", () => {
        window.location.hash = `#/n/${projectId}/${kind}/${item.id}`;
      })
    );
    li.querySelectorAll("[data-pchip]").forEach((b) =>
      b.addEventListener("click", () => {
        selectedPersonId = b.dataset.pchip;
        window.location.hash = "#/people";
      })
    );
  }

  section.querySelectorAll(".item").forEach((li) => {
    const item = items.find((i) => i.id === li.dataset.id);
    wireItem(li, item);
  });
}
