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
  const g = (text, done = false) => ({
    id: uid(), text, done,
    createdAt: new Date().toISOString(),
    ...(done ? { closedAt: new Date().toISOString() } : {}),
  });
  return {
    projects: [
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
/* fill in organs for tracker items at any depth. depth 1 = a secondary
   (direct child of a top-level project): those get a permanent Tracker by
   default. Deeper items are leaves unless they already have a tracker. */
function ensureSubtree(items, depth) {
  items.forEach((c) => {
    if (c.stage === "active") c.stage = "progress"; // merged stages
    if (!c.stage) c.stage = "watch";
    if (!c.notesList) c.notesList = [];
    if (!c.goals) c.goals = [];
    if (!c.tasks) c.tasks = [];
    if (!c.links) c.links = [];
    if (c.masterLink === undefined) c.masterLink = "";
    if (c.masterName === undefined) c.masterName = "";
    if (!c.docs) c.docs = [];
    // old side-panel notes become the first note card
    if (c.notes && c.notes.trim()) {
      c.notesList.unshift({ id: uid(), text: c.notes, createdAt: new Date().toISOString() });
      delete c.notes;
    }
    // secondaries carry a Tracker by default; it can't be removed (no delete UI)
    if (depth === 1 && !c.tracker) c.tracker = { name: "Tracker", items: [] };
    [...c.goals, ...c.tasks].forEach((t) => {
      if (!t.createdAt) t.createdAt = new Date().toISOString();
      if (t.done && !t.closedAt) t.closedAt = new Date().toISOString();
    });
    c.notesList.forEach((n) => {
      if (!n.createdAt) n.createdAt = c.createdAt || new Date().toISOString();
      if (!n.updatedAt) n.updatedAt = n.createdAt;
    });
    if (c.tracker) {
      if (!c.tracker.items) c.tracker.items = [];
      ensureSubtree(c.tracker.items, depth + 1);
    }
  });
}

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
    if (!p.docs) p.docs = [];   // (legacy) standalone project docs
    if (!p.links) p.links = []; // project-level links
    if (p.masterLink === undefined) p.masterLink = ""; // the one main link for the project
    if (p.masterName === undefined) p.masterName = ""; // display name, auto-pulled from the link

    // companies in a tracker are full sub-projects: give them the same organs,
    // recursively, and hand every secondary its default Tracker
    if (p.tracker) {
      if (!p.tracker.items) p.tracker.items = [];
      ensureSubtree(p.tracker.items, 1);
    }

    // timestamps: every task/goal gets a createdAt; every done one gets a closedAt
    [...p.goals, ...p.tasks].forEach((t) => {
      if (!t.createdAt) t.createdAt = new Date().toISOString();
      if (t.done && !t.closedAt) t.closedAt = new Date().toISOString();
    });
    p.notesList.forEach((n) => {
      if (!n.createdAt) n.createdAt = p.createdAt || new Date().toISOString();
      if (!n.updatedAt) n.updatedAt = n.createdAt;
    });

    // recover any orphaned docs: they become note cards in the Notes tab
    if (p.docs.length) {
      p.docs.forEach((d) => {
        const body = (d.note || "").trim();
        const title = (d.text || "").trim();
        if (!body && (!title || title === "Untitled doc")) return; // truly empty
        const heading = title && title !== "Untitled doc" ? `<b>${escapeHtml(title)}</b><br>` : "";
        p.notesList.unshift({
          id: uid(),
          text: heading + (body || ""),
          createdAt: d.createdAt || new Date().toISOString(),
        });
      });
      p.docs = [];
    }
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

  // ---- timestamp cleanups: pinned to ABSOLUTE dates (never "the current
  // week", which shifts under our feet at midnight) ----
  // time-tracking shipped during the week of Jul 13–19, 2026; anything from
  // before it is anchored to that Sunday night
  const TRACK_START = new Date(2026, 6, 13);
  const ANCHOR = new Date(2026, 6, 19, 23, 59, 0).toISOString(); // Sun Jul 19, 11:59 PM

  if (!s.tsNormalized) {
    s.projects.forEach((p) =>
      [...p.goals, ...p.tasks].forEach((t) => {
        if (new Date(t.createdAt) < TRACK_START) t.createdAt = ANCHOR;
        if (t.done && (!t.closedAt || new Date(t.closedAt) < TRACK_START)) t.closedAt = ANCHOR;
      })
    );
    s.tsNormalized = true;
  }

  // repair: an earlier version of the cleanup above keyed off "this week", so
  // if it first ran on/after Mon Jul 20 it overwrote last week's real
  // timestamps with that moment — leaving batches of items sharing one
  // identical machine stamp. Real creations never share the same second, so
  // groups of 2+ identical stamps on/after Jul 20 are the fingerprint:
  // send them back to the Sunday anchor where they belong.
  if (!s.tsRepaired) {
    const cutoff = new Date(2026, 6, 20);
    const bySecond = {};
    const key = (iso) => iso.slice(0, 19);
    s.projects.forEach((p) =>
      [...p.goals, ...p.tasks].forEach((t) => {
        [t.createdAt, t.closedAt].forEach((iso) => {
          if (iso && new Date(iso) >= cutoff) bySecond[key(iso)] = (bySecond[key(iso)] || 0) + 1;
        });
      })
    );
    s.projects.forEach((p) =>
      [...p.goals, ...p.tasks].forEach((t) => {
        if (t.createdAt && new Date(t.createdAt) >= cutoff && bySecond[key(t.createdAt)] > 1) t.createdAt = ANCHOR;
        if (t.closedAt && new Date(t.closedAt) >= cutoff && bySecond[key(t.closedAt)] > 1) t.closedAt = ANCHOR;
      })
    );
    s.tsRepaired = true;
  }

  // one-time cleanup: legacy notes inherited guessed dates from before
  // time-tracking existed — anchor them to the Sunday that tracking arrived,
  // so they belong to that week's report
  if (!s.notesAnchored) {
    s.projects.forEach((p) =>
      p.notesList.forEach((n) => {
        if (new Date(n.createdAt) < TRACK_START) n.createdAt = ANCHOR;
        if (n.updatedAt && new Date(n.updatedAt) < new Date(n.createdAt)) n.updatedAt = n.createdAt;
      })
    );
    s.notesAnchored = true;
  }

  // one-time cleanup: drop the sample projects — real records only
  if (!s.seedPurged) {
    const drop = new Set(["DailySpace Website", "Fitness & Health"]);
    const ids = s.projects.filter((p) => drop.has(p.name)).map((p) => p.id);
    if (ids.length) {
      s.projects = s.projects.filter((p) => !ids.includes(p.id));
      s.collections.forEach((c) => {
        c.items = c.items.filter((i) => !(i.type === "project" && ids.includes(i.id)));
      });
      s.archived = s.archived.filter((a) => !(a.type === "project" && ids.includes(a.id)));
    }
    s.seedPurged = true;
  }
  applyImports(s);
  return s;
}

/* ---------- one-time imports (meeting notes → spaces) ----------
   Each import runs once per space: its key is recorded in s.imports, which
   syncs to the cloud, so other devices never re-apply it. Items merge into an
   existing project / tracker company with the same name instead of
   duplicating, and a task or goal whose text already exists is skipped. */

let importsAppliedNow = false; // true when this load added something → push to cloud

const IMPORTS = [
  { key: "meeting-2026-11-13", at: new Date(2026, 10, 13, 12, 0, 0).toISOString(), build: import20261113 },
  { key: "meeting-2026-11-13-goals", at: new Date(2026, 10, 13, 12, 0, 0).toISOString(), build: link20261113 },
  { key: "owners-due-2026-11-16", at: new Date(2026, 10, 16, 9, 0, 0).toISOString(), build: ownersAndDue20261116 },
  { key: "others-space-2026-11-17", at: new Date(2026, 10, 17, 12, 0, 0).toISOString(), build: othersSpace20261117 },
];

/* "Others" is the catch-all space for things that belong nowhere else:
   make sure it exists and sits in Spaces (not tucked in a collection or archived) */
function othersSpace20261117({ project, s }) {
  const p = project("Others");
  s.collections.forEach((c) => { c.items = c.items.filter((it) => !(it.type === "project" && it.id === p.id)); });
  s.archived = s.archived.filter((a) => !(a.type === "project" && a.id === p.id));
  if (!p.description) p.description = "Anything that doesn't belong to another space";
}

function applyImports(s) {
  if (!s.imports) s.imports = {};
  IMPORTS.forEach((imp) => {
    if (s.imports[imp.key]) return;
    const at = imp.at;
    const item = (text, extra = {}) => ({
      id: uid(), text, done: false, createdAt: at, ...extra,
      ...(extra.done ? { closedAt: at } : {}),
    });
    const note = (html) => ({ id: uid(), text: html, createdAt: at, updatedAt: at });
    const organs = () => ({
      goals: [], tasks: [], notesList: [], links: [], docs: [],
      masterLink: "", masterName: "",
    });
    const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const personId = (name) => {
      const per = s.people.find((x) => same(x.name, name));
      return per ? [per.id] : undefined;
    };

    /* merge goals / tasks / notes / focus into a project or tracker company */
    const fill = (target, spec) => {
      if (spec.focus && !target.focus) target.focus = spec.focus;
      if (spec.description && !target.description) target.description = spec.description;
      (spec.goals || []).forEach(([text, extra]) => {
        if (!target.goals.some((g) => same(g.text, text))) target.goals.push(item(text, extra));
      });
      (spec.tasks || []).forEach(([text, extra = {}]) => {
        if (target.tasks.some((t) => same(t.text, text))) return;
        const { person, ...rest } = extra;
        const people = person && personId(person);
        target.tasks.push(item(text, { ...rest, ...(people ? { people } : {}) }));
      });
      (spec.notes || []).forEach((html) => target.notesList.unshift(note(html)));
    };

    /* top-level project by name, created when missing */
    const project = (name) => {
      let p = s.projects.find((x) => same(x.name, name));
      if (!p) {
        // continue the top row of project icons, left to right
        const taken = s.projects.filter((x) => x.pos && x.pos.y < 15).length;
        p = {
          id: uid(), name, description: "", focus: "", notes: "",
          ...organs(),
          pos: { x: Math.min(80, 2.5 + taken * 7.5), y: 5 },
          createdAt: at,
        };
        s.projects.push(p);
      }
      return p;
    };

    /* company inside a project's tracker, created when missing */
    const company = (parent, name, stage) => {
      if (!parent.tracker) parent.tracker = { name: "Tracker", items: [] };
      let c = parent.tracker.items.find((x) => same(x.name, name));
      if (!c) {
        c = { id: uid(), name, stage, ...organs(), tracker: { name: "Tracker", items: [] } };
        parent.tracker.items.push(c);
      }
      return c;
    };

    /* file existing tasks under an existing goal (never creates anything,
       never moves a task that already sits under a goal) */
    const link = (projectName, goalText, taskTexts) => {
      const p = s.projects.find((x) => same(x.name, projectName));
      const g = p && p.goals.find((x) => same(x.text, goalText));
      if (!g) return;
      p.tasks.forEach((t) => {
        if (!t.goalId && taskTexts.some((txt) => same(t.text, txt))) t.goalId = g.id;
      });
    };

    /* a person by name, created when missing */
    const person = (name) => {
      let per = s.people.find((x) => same(x.name, name));
      if (!per) {
        // (imports run at startup, before PEOPLE_COLORS is defined further down)
        const colors = ["#4ade80", "#60a5fa", "#fbbf24", "#c084fc", "#f87171", "#2dd4bf", "#fb923c", "#a3e635"];
        per = { id: uid(), name, desc: "", color: colors[s.people.length % colors.length] };
        s.people.push(per);
      }
      return per;
    };

    /* every task in every space, trackers included */
    const eachTask = (fn) => {
      const visit = (node) => {
        (node.tasks || []).forEach(fn);
        if (node.tracker) node.tracker.items.forEach(visit);
      };
      s.projects.forEach(visit);
    };

    imp.build({ project, company, fill, link, person, eachTask, same, s });
    s.imports[imp.key] = new Date().toISOString();
    importsAppliedNow = true;
  });
}

/* owners from the "N to …" convention, and the deadlines the 13 Nov notes
   spelled out ("today" = Fri 13 Nov, "before Monday" = Mon 16 Nov) */
function ownersAndDue20261116({ person, eachTask, same }) {
  const nikhel = person("Nikhel");
  const vishal = person("Vishal");
  const due = {
    "N to speak to Hadi about the licensing structure": "2026-11-13",
    "N to move the money": "2026-11-13",
    "D to contact the bank relationship manager about a debit card": "2026-11-13",
    "Share the updated gold proposal with Michael": "2026-11-13",
    "D to pick a 1-hour weekend slot when N can help point the domain": "2026-11-15",
    "Work with Vishal on Peter's suggested query fixes (before Monday)": "2026-11-16",
  };
  eachTask((t) => {
    if (!t.owner) {
      if (/^N\s+to\b/i.test(t.text)) t.owner = nikhel.id;
      else if (same(t.text, "Vishal to document the Hyperliquid work and outcomes")) t.owner = vishal.id;
    }
    if (!t.due) {
      const k = Object.keys(due).find((txt) => same(t.text, txt));
      if (k) t.due = due[k];
    }
  });
}

/* goals → subtasks: put the 13 Nov tasks under the goals they serve */
function link20261113({ link }) {
  link("Family Office", "Agree the offering terms with Arya Bank", [
    "D to post the Arya Bank terms email in the group with Rami",
    "N to speak to Hadi about the licensing structure",
  ]);
  link("Family Office", "Get the FO Agreement and the full deal data from Rami", [
    "D to nudge Rami for the FO Agreement draft + consolidated data, holdings, pricing and transaction structure",
  ]);
  link("Gold", "Start the supply-side conversation with Michael", [
    "Convert Rami's document to PDF and send it to N",
    "N to read Rami's document",
    "N to contact Michael, then create a WhatsApp group with Michael and D",
  ]);
  link("Gold", "Finalize the gold proposal and set the next steps", [
    "Share the updated gold proposal with Michael",
    "Validate and finalize the proposal, then identify the next steps",
  ]);
  link("Project 23", "Move the money and get a debit card on the account", [
    "N to move the money",
    "D to contact the bank relationship manager about a debit card",
  ]);
  link("Google Migration", "Point the domain to Google Workspace", [
    "D to pick a 1-hour weekend slot when N can help point the domain",
  ]);
}

/* 13 Nov 2026 — D (Durai) & N (Nikhel) catch-up */
function import20261113({ project, company, fill }) {
  const src = "<i>From the 13 Nov 2026 catch-up</i>";

  fill(project("Family Office"), {
    description: "Offload the family office assets through Arya Bank.",
    focus: "Agree the offering terms with Arya Bank",
    goals: [
      ["Agree the offering terms with Arya Bank"],
      ["Get the FO Agreement and the full deal data from Rami"],
    ],
    tasks: [
      ["D to post the Arya Bank terms email in the group with Rami", {
        tag: "think",
        note: `<p><b>To:</b> Pascal at Arya Bank<br><b>Subject:</b> Proposed terms for family office asset offering</p>
<p>Dear Pascal,</p>
<p>Following our discussions, we'd like to propose the following terms for the family office asset offering:</p>
<ul>
<li><b>Initial period:</b> Six weeks, with the option to discuss an extension based on progress.</li>
<li><b>Arya Bank priority period:</b> For the first three weeks, Arya Bank would have the exclusive opportunity to offer the assets to its clients.</li>
<li><b>Additional buyers:</b> If the offering has not closed during those three weeks, we may bring in additional buyers. Any buyers we introduce would be subject to Arya Bank's KYC requirements.</li>
<li><b>Fees:</b> A flat 10% fee, with no recurring fees: 5% to Arya Bank and 5% to our side.</li>
</ul>
<p>Could you also clarify what relationship a buyer of these assets would need to establish with Arya Bank? In particular, would they need to open an account with the bank?</p>
<p>Please let us know your thoughts on the proposed structure.</p>
<p>Best,<br>Durai</p>`,
      }],
      ["D to nudge Rami for the FO Agreement draft + consolidated data, holdings, pricing and transaction structure", { tag: "call" }],
      ["N to speak to Hadi about the licensing structure", { tag: "call" }],
    ],
    notes: [`<b>Proposed terms for Arya Bank (Pascal)</b><br>${src}
<ul>
<li><b>Initial period:</b> 6 weeks, extension open based on progress</li>
<li><b>Priority period:</b> first 3 weeks exclusive to Arya Bank's clients</li>
<li><b>Additional buyers:</b> we can bring buyers in after week 3; they go through Arya Bank's KYC</li>
<li><b>Fees:</b> flat 10%, no recurring fees: 5% Arya Bank, 5% our side</li>
<li><b>Open question:</b> what relationship does a buyer need with Arya Bank? Do they need to open an account?</li>
</ul>
The full email is in the note on the "post the Arya Bank terms email" task.`],
  });

  fill(project("Gold"), {
    description: "Gold proposal and the supply side with Michael.",
    focus: "Finalize the gold proposal with Michael",
    goals: [
      ["Start the supply-side conversation with Michael"],
      ["Finalize the gold proposal and set the next steps"],
    ],
    tasks: [
      ["Convert Rami's document to PDF and send it to N", { done: true }],
      ["N to read Rami's document", { tag: "read" }],
      ["N to contact Michael, then create a WhatsApp group with Michael and D", { tag: "call" }],
      ["Share the updated gold proposal with Michael"],
      ["Validate and finalize the proposal, then identify the next steps", { tag: "think" }],
    ],
    notes: [`<b>Gold: next steps, in order</b><br>${src}
<ol>
<li>Convert Rami's document to PDF and send it to Nikhel (sent; Nikhel to read it)</li>
<li>Nikhel contacts Michael first, then creates a WhatsApp group with Michael and Durai to start the supply-side conversation</li>
<li>Share the updated gold proposal with Michael</li>
<li>Validate and finalize the proposal, then identify the next steps</li>
</ol>`],
  });

  fill(company(project("Secondaries"), "Neuralink", "progress"), {
    tasks: [
      ["N to confirm the valuation"],
      ["N to get answers to the other questions Rami raised"],
    ],
    notes: [`<b>Neuralink follow-up</b><br>${src}<br>Nikhel to confirm the valuation and get answers to the other questions Rami raised.`],
  });

  fill(project("Project 23"), {
    goals: [["Move the money and get a debit card on the account"]],
    tasks: [
      ["N to move the money"],
      ["D to contact the bank relationship manager about a debit card", { tag: "call" }],
    ],
    notes: [`<b>Project 23</b><br>${src}<br>Nikhel moves the money; Durai contacts the bank relationship manager about a debit card.`],
  });

  fill(project("Google Migration"), {
    focus: "Point the domain to Google Workspace",
    goals: [["Point the domain to Google Workspace"]],
    tasks: [
      ["D to pick a 1-hour weekend slot when N can help point the domain"],
    ],
    notes: [`<b>Google migration</b><br>${src}<br>Durai picks an hour over the weekend when Nikhel is free to help point the domain to Google Workspace.`],
  });

  const q4 = project("Q4 Projects");
  fill(q4, {
    description: "Every Q4 project in one list.",
    notes: [`<b>Q4 projects</b><br>${src}<br>Stryde, Claylight, Aya and MotoGP, tracked together in this space's Tracker.`],
  });
  ["Stryde", "Claylight", "Aya", "MotoGP"].forEach((n) => company(q4, n, "watch"));

  fill(project("Hampstead"), {
    tasks: [
      ["Work with Vishal on Peter's suggested query fixes (before Monday)", { person: "Peter" }],
      ["Vishal to document the Hyperliquid work and outcomes"],
    ],
    notes: [`<b>Hampstead</b><br>${src}<br>Work with Vishal on Peter's suggested query fixes before Monday. Vishal had also been asked to document the Hyperliquid work and outcomes.`],
  });

  fill(project("Others"), {
    tasks: [["Book a 1-hour 1:1: D x N", { tag: "call" }]],
  });
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
    // restored session that sat idle past the limit → straight back to the gate
    if (cloud.user && idleExpired()) { db.auth.signOut(); return; }
    if (cloud.user && !hadUser) loadCloud();
    else route(); // no session → show the password gate
    if (!cloud.user) { cloud.status = "signedout"; updateSyncChip(); }
  });
}

/* ---------- auto-lock: 30 minutes of inactivity → password gate ---------- */

const IDLE_LIMIT = 30 * 60 * 1000;
const IDLE_KEY = "dailyspace-last-active";

let idleLastWrite = 0;
function touchActivity(force) {
  const now = Date.now();
  if (!force && now - idleLastWrite < 10000) return; // throttle writes
  idleLastWrite = now;
  localStorage.setItem(IDLE_KEY, String(now));
}

function idleExpired() {
  const last = +localStorage.getItem(IDLE_KEY) || 0;
  return !!last && Date.now() - last > IDLE_LIMIT;
}

["pointerdown", "keydown", "touchstart", "scroll"].forEach((ev) =>
  window.addEventListener(ev, () => touchActivity(false), { passive: true })
);

// works while the tab is open AND when coming back to a stale tab
setInterval(() => {
  if (db && cloud.user && idleExpired()) db.auth.signOut(); // onAuthStateChange shows the gate
}, 30000);

/* on login: cloud is the source of truth; first login pushes local data up */
async function loadCloud() {
  cloud.status = "loading";
  updateSyncChip();
  const { data: row, error } = await db.from("spaces").select("data").maybeSingle();
  if (error) { cloud.status = "error"; updateSyncChip(); return; }
  if (row && row.data) {
    importsAppliedNow = false;
    state = ensureDefaults(row.data);
    Store.save(state);
    cloud.status = "synced";
    route();
    if (importsAppliedNow) await cloudSaveNow(); // new imported items → sync them up
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

/* full-screen password gate — the only way in: a quiet lock screen */
const GATE_ARROW = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h11M11 5.5 15.5 10 11 14.5"/></svg>`;
const GATE_SCENE = `<svg class="gate-scene" viewBox="0 0 240 150" fill="none" aria-hidden="true">
  <defs>
    <radialGradient id="gs-glow" cx="1" cy="0.55" r="0.9"><stop offset="0" stop-color="#f3e6c8" stop-opacity=".55"/><stop offset="1" stop-color="#f3e6c8" stop-opacity="0"/></radialGradient>
  </defs>
  <g class="gs-line">
    <path class="gs-faint" d="M24 140h196"/>
    <path d="M104 96h112M204 96v44"/>
    <path class="gs-glow" d="M168 95 L174 66 L118 78 L112 95 Z" fill="url(#gs-glow)" stroke="none"/>
    <path d="M128 95h40M168 95l6-28"/>
    <path d="M187 85h10v11h-10z M197 88c4 0 4 6 0 6"/>
    <path class="gs-steam s1" d="M190 80c-3-4 3-6 0-10"/>
    <path class="gs-steam s2" d="M194 79c-3-4 3-6 0-10"/>
    <path d="M64 70l4 38h30M82 108v32M72 140h20"/>
    <path d="M88 104c4-14 4-24 8-32"/>
    <g class="gs-head"><circle cx="104" cy="58" r="10"/><path d="M95 54c2-8 12-11 18-4"/></g>
    <path d="M97 76l15 15"/>
    <g class="gs-hand"><path d="M112 91h19"/></g>
    <path d="M88 104l30 2 2 32h9"/>
  </g>
</svg>`;
/* the one line under the password */
const GATE_LINE = ["Impatience with actions, patience with results.", "Naval Ravikant"];
function renderGate(message) {
  app.innerHTML = `
    <div class="desktop desktop-gate">
      <div class="gate">
        <div class="gate-orb" aria-hidden="true"></div>
        <div class="gate-stage">
          ${GATE_SCENE}
          <h1 class="gate-title">Daily<em>Space</em></h1>
          <p class="gate-line">${GATE_LINE[0]}<span>${GATE_LINE[1]}</span></p>
          ${cloud.ready ? `
            <form class="gate-field" id="gate-form" autocomplete="on">
              <input type="text" name="username" value="${escapeHtml(OWNER_EMAIL)}" autocomplete="username" hidden />
              <input type="password" id="gate-pass" placeholder="Password" maxlength="100" autocomplete="current-password" aria-label="Password" />
              <button type="submit" class="gate-go" id="gate-enter" aria-label="Unlock">${GATE_ARROW}</button>
            </form>
            <p class="gate-error" id="gate-error" role="alert">${message || ""}</p>
          ` : `<div class="gate-loading" aria-label="Loading"><span></span></div>`}
        </div>
      </div>
    </div>
  `;

  const pass = app.querySelector("#gate-pass");
  if (!pass) return;
  pass.focus();

  const form = app.querySelector("#gate-form");
  const errorEl = app.querySelector("#gate-error");
  const btn = app.querySelector("#gate-enter");
  const fail = (msg) => {
    errorEl.textContent = msg;
    form.classList.remove("busy", "shake");
    void form.offsetWidth; // restart the shake
    form.classList.add("shake");
    pass.select();
  };
  pass.addEventListener("input", () => { errorEl.textContent = ""; form.classList.toggle("filled", !!pass.value); });

  async function unlock() {
    const password = pass.value;
    if (form.classList.contains("busy")) return;
    if (password.length < 6) { if (password) fail("That’s too short."); return; }
    errorEl.textContent = "";
    form.classList.add("busy");

    const { error } = await db.auth.signInWithPassword({ email: OWNER_EMAIL, password });
    if (!error) { form.classList.add("ok"); touchActivity(true); return; } // fresh unlock resets the idle clock

    if (/invalid login/i.test(error.message)) {
      // first ever visit: no account yet → this password becomes THE password
      const { data, error: e2 } = await db.auth.signUp({ email: OWNER_EMAIL, password });
      if (!e2 && data.session) { touchActivity(true); return; }
      if (!e2 && data.user) {
        form.classList.remove("busy");
        errorEl.textContent = "First-time setup: confirm the email we just sent, then enter again.";
        return;
      }
      fail("Not quite. Try again.");
    } else {
      fail(error.message);
    }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); unlock(); });
  btn.blur();
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

/* full timestamp: "Jul 19, 2026 · 9:41 PM" */
function fmtDT(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

/* single source of truth for completing / reopening a task or goal:
   stamps closedAt on completion, clears it on reopen */
function setDone(item, done) {
  item.done = done;
  if (done) item.closedAt = new Date().toISOString();
  else delete item.closedAt;
}

/* compact, context-aware timestamp: "9:41 PM" today, "Yesterday, 9:41 PM",
   "Jul 12, 9:41 PM" this year, "Jul 12, 2025, 9:41 PM" beyond */
function smartDT(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const now = new Date();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return time;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return "Yesterday, " + time;
  const opts = { month: "short", day: "numeric" };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts) + ", " + time;
}

/* meta line under a task/goal: created time + closed time */
function itemMetaHtml(item) {
  const bits = [];
  if (item.createdAt) bits.push(`<span class="meta-chip" title="Created">＋ ${fmtDT(item.createdAt)}</span>`);
  if (item.done && item.closedAt) bits.push(`<span class="meta-chip meta-closed" title="Completed">✓ ${fmtDT(item.closedAt)}</span>`);
  return bits.join("");
}

/* one quiet stamp per note: the most recent event wins, hover reveals both */
function noteStampHtml(n) {
  if (!n.createdAt) return "";
  const edited = n.updatedAt && n.updatedAt !== n.createdAt;
  const tip = `Created ${fmtDT(n.createdAt)}${edited ? `&#10;Edited ${fmtDT(n.updatedAt)}` : ""}`;
  return `<span class="stamp" title="${tip}">
    <span class="stamp-part">Created ${smartDT(n.createdAt)}</span>
    ${edited ? `<span class="stamp-part">Edited ${smartDT(n.updatedAt)}</span>` : ""}
  </span>`;
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
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11 5.93"/><path d="M14 10a5 5 0 00-7.07 0l-2.83 2.83a5 5 0 007.07 7.07L13 18.07"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  review: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 10h18"/><path d="M8 15h4M8 18h7"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  broom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
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

// Today is parked for now: flip to true to bring back the panel, dock button and phone landing
const TODAY_ENABLED = false;
let mobileHomeShown = false;

function route() {
  // locked until the password is entered
  if (db && !cloud.user) { renderGate(); return; }

  // phones open on Today the first time in; the ← button leads to the desktop
  if (!mobileHomeShown) {
    mobileHomeShown = true;
    const h = window.location.hash;
    if (TODAY_ENABLED && IS_MOBILE && (!h || h === "#" || h === "#/")) {
      history.replaceState(null, "", "#/today");
    }
  }

  if (TODAY_ENABLED && window.location.hash === "#/today") { renderTodayPage(); return; }

  const wMatch = window.location.hash.match(/^#\/w\/(call|read|think|sign)$/);
  if (wMatch) { renderDesktop(null, wMatch[1]); return; }

  // full-page note for a task/goal
  const nMatch = window.location.hash.match(/^#\/n\/([^/]+)\/(goals|tasks|docs)\/(.+)$/);
  if (nMatch) {
    const np = containerByRef(nMatch[1]);
    const nItem = np && np[nMatch[2]].find((i) => i.id === nMatch[3]);
    if (nItem) { renderNotePage(nMatch[1], nMatch[2], nMatch[3]); return; }
  }

  if (window.location.hash === "#/a") { renderDesktop(null, null, null, true); return; }
  if (window.location.hash === "#/people") { renderPeoplePage(); return; }
  if (window.location.hash === "#/review") { renderReviewPage(); return; }

  const cMatch = window.location.hash.match(/^#\/c\/(.+)$/);
  if (cMatch && state.collections.find((c) => c.id === cMatch[1])) {
    renderDesktop(null, null, cMatch[1]);
    return;
  }

  const match = window.location.hash.match(/^#\/p\/(.+)$/);
  if (match && containerByRef(match[1])) { renderProjectPage(match[1]); return; }

  renderDesktop(null);
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

/* ---------- 3. DESKTOP ---------- */

/* widgets start fresh from the 13 Nov 2026 restart: older items stay in
   their spaces but no longer feed the desktop widgets */
const WIDGET_SINCE = new Date(2026, 10, 13);

function taggedTasks(tag) {
  const source = WIDGETS[tag].source; // "tasks" or "goals"
  const out = [];
  state.projects.forEach((p) => {
    if (isArchived("project", p.id)) return; // archived projects rest quietly
    p[source].forEach((t) => {
      if (t.tag !== tag) return;
      if (t.createdAt && new Date(t.createdAt) < WIDGET_SINCE) return;
      out.push({ task: t, project: p });
    });
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

/* ---------- owners & due dates ----------
   task.owner: unset = me, otherwise a person id.
   task.due:   "YYYY-MM-DD" (local date), optional. */

function isMine(t) {
  return !t.owner || t.owner === "me" || !personById(t.owner);
}

function dateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function keyToDate(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/* days from today to the due date: 0 = today, -1 = yesterday, 1 = tomorrow */
function dueDelta(k) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((keyToDate(k) - t) / 86400000);
}

function dueLabel(k) {
  const n = dueDelta(k);
  const d = keyToDate(k);
  const short = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 1 && n < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return short;
}

function dueChipHtml(item) {
  if (!item.due) return "";
  const n = dueDelta(item.due);
  const cls = item.done ? "" : n < 0 ? "due-over" : n === 0 ? "due-today" : n <= 2 ? "due-soon" : "";
  const label = !item.done && n < 0 ? `Overdue · ${dueLabel(item.due)}` : dueLabel(item.due);
  return `<span class="due-chip ${cls}">${label}</span>`;
}

/* owner chip: only for tasks someone else owns */
function ownerChipHtml(item) {
  if (isMine(item)) return "";
  const per = personById(item.owner);
  return `<span class="owner-chip" style="--pc:${per.color}" >${escapeHtml(per.name.split(" ")[0])}</span>`;
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
    <div class="desktop view-${homeView()}" data-desktop>
      <div class="menubar">
        <div class="menubar-left">
          <span class="wordmark">Daily<em>Space</em></span>
        </div>
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

      ${homeView() === "columns" ? columnsHtml() : ""}
      <div class="desktop-items ${state.timebarHidden ? "" : "with-timebar"}" data-items ${homeView() === "columns" ? "hidden" : ""}>
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

      ${state.projects.length || homeView() === "columns" ? "" : `<div class="desktop-hint">Your desktop is empty — press + in the dock to create a project</div>`}

      ${IS_MOBILE || !TODAY_ENABLED ? "" : todayPanelHtml()}

      <div class="dock">
        <button class="dock-btn" data-tip="Add" data-dock-add>${ICONS.plus}</button>
        <div class="dock-sep"></div>
        ${TODAY_ENABLED ? `<button class="dock-btn" data-tip="Today" data-dock-today>${ICONS.today}
          ${(() => { const n = todayUrgentCount(); return `<span class="archive-count" data-today-badge ${n ? "" : "hidden"}>${n}</span>`; })()}
        </button>
        <div class="dock-sep"></div>` : ""}
        <button class="dock-btn" data-tip="Tidy icons" data-dock-tidy>${ICONS.broom}</button>
        <div class="dock-sep"></div>
        <button class="dock-btn" data-tip="Review" data-dock-review>${ICONS.review}</button>
        <div class="dock-sep"></div>
        <button class="dock-btn" data-tip="Archive" data-archive>${ICONS.archive}
          ${state.archived.length ? `<span class="archive-count">${state.archived.length}</span>` : ""}
        </button>

      </div>

      <!-- mobile only: the dock's shortcuts button pops these up above it -->
      <div class="fab-wrap" data-fab-wrap>
        <div class="fab-menu">
          ${Object.entries(WIDGETS).map(([kind, w]) => {
            const n = taggedTasks(kind).filter((x) => !x.task.done).length;
            return `
            <button class="fab-item" data-fab-go="#/w/${kind}" style="--wt:${w.tint}">
              <span class="fab-label">${w.label}</span>
              <span class="fab-icon">${w.icon}${n ? `<i class="fab-count">${n}</i>` : ""}</span>
            </button>`;
          }).join("")}
          ${(() => {
            const n = state.people.filter((per) =>
              tasksForPerson(per.id).some((x) => !x.task.done)).length;
            return `
            <button class="fab-item" data-fab-go="#/people" style="--wt:#f472b6">
              <span class="fab-label">People</span>
              <span class="fab-icon">${ICONS.users}${n ? `<i class="fab-count">${n}</i>` : ""}</span>
            </button>`;
          })()}
        </div>
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
  maybeShowWhatsNew();
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

  // mobile shortcuts: dock button pops the menu above the dock
  const fabWrap = app.querySelector("[data-fab-wrap]");
  const appsBtn = app.querySelector("[data-dock-apps]");
  if (fabWrap && appsBtn) {
    appsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fabWrap.classList.toggle("open");
    });
    fabWrap.querySelectorAll("[data-fab-go]").forEach((b) =>
      b.addEventListener("click", () => (window.location.hash = b.dataset.fabGo))
    );
    desktop.addEventListener("pointerdown", (e) => {
      if (!e.target.closest("[data-fab-wrap], [data-dock-apps]")) fabWrap.classList.remove("open");
    });
  }

  if (homeView() === "columns") {
    wireColumns();
    const sc = app.querySelector("[data-cols-scroll]");
    if (sc) sc.scrollLeft = sc.scrollWidth;
  }

  // dock
  app.querySelector("[data-dock-add]").addEventListener("click", showAddChooser);
  app.querySelector("[data-dock-review]").addEventListener("click", () => (window.location.hash = "#/review"));
  app.querySelector("[data-dock-today]")?.addEventListener("click", () => (window.location.hash = "#/today"));
  wireTodayPanel();
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

/* ---------- home views: Desktop (icons) or Columns (Finder-style) ----------
   The view lives in state.homeView and syncs; the open path in the columns
   is a per-device convenience kept in localStorage. */

const CHEVRON_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const COL_ICONS = {
  goal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  stack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M9 11h6M9 15h6"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 10.5h17"/></svg>',
  links: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
};

function homeView() { return "columns"; } // the icon desktop is retired

/* ---- the column tree ----
   keys: root · p:<ref> · g:<ref>:<goalId> · o:<ref> (Others) · nl:<ref> (Notes)
         lk:<ref> (space links) · t:<ref>:<taskId> · n:<ref>:<noteId>
         c:<collectionId> · l:<linkId> · w:<widget> · people · per:<personId> */

let colPath = (() => {
  try { return JSON.parse(localStorage.getItem("dailyspace-colpath") || "[]"); } catch { return []; }
})();
function saveColPath() {
  try { localStorage.setItem("dailyspace-colpath", JSON.stringify(colPath)); } catch {}
}

function colSplit(key) {
  const i = key.indexOf(":");
  return i < 0 ? [key, ""] : [key.slice(0, i), key.slice(i + 1)];
}

function plainText(html) {
  const d = document.createElement("div");
  d.innerHTML = html || "";
  return (d.textContent || "").replace(/\s+/g, " ").trim();
}

function spaceStats(p) {
  const open = p.tasks.filter((t) => !t.done);
  return {
    open: open.length,
    over: open.filter((t) => t.due && dueDelta(t.due) < 0).length,
    goals: p.goals.filter((g) => !g.done).length,
    notes: p.notesList.length,
    subs: p.tracker ? p.tracker.items.filter((c) => c.stage !== "closed").length : 0,
  };
}

/* every task in every open space (sub-projects included), with its ref */
function allTaskRefs() {
  const out = [];
  allSpaces().forEach((s) => s.node.tasks.forEach((t) => out.push({ task: t, ref: s.ref, space: s })));
  return out;
}

function colTaskSort(a, b) {
  if (!!a.done !== !!b.done) return a.done ? 1 : -1;
  return (a.due || "9999").localeCompare(b.due || "9999");
}

/* a node knows how to draw its row, list its children, or preview itself */
function colNode(key) {
  const [kind, rest] = colSplit(key);
  if (kind === "root") {
    const isOthers = (p) => p.name.trim().toLowerCase() === "others";
    const spaces = state.projects.filter((p) => onDesktop("project", p.id))
      .sort((a, b) => isOthers(a) - isOthers(b));
    const cols = state.collections.filter((c) => !isArchived("collection", c.id));
    const links = state.links.filter((l) => onDesktop("link", l.id));
    return {
      title: "Home",
      sections: [
        { title: "Spaces", keys: spaces.map((p) => "p:" + p.id) },
        { title: "Collections", keys: cols.map((c) => "c:" + c.id) },
        { title: "Links", keys: links.map((l) => "l:" + l.id) },
        { title: "Lists", keys: [...Object.keys(WIDGETS).map((k) => "w:" + k), "people"] },
      ],
    };
  }
  if (kind === "p") {
    const p = containerByRef(rest);
    if (!p) return null;
    const isSub = rest.includes("~");
    const accent = isSub ? kcolor(p.name) : accentFor(rest);
    const st = spaceStats(p);
    const subs = p.tracker ? p.tracker.items.filter((c) => c.stage !== "closed") : [];
    const goals = p.goals.slice().sort(colTaskSort);
    return {
      title: p.name,
      label: p.name,
      icon: `<span class="col-tile" style="--pa:${accent}">${escapeHtml(initials(p.name))}</span>`,
      meta: st.open ? `${st.over ? `<span class="col-over-dot" title="${st.over} overdue"></span>` : ""}${st.open}` : "",
      folder: true,
      open: () => (window.location.hash = "#/p/" + rest),
      sections: [
        ...(p.tracker ? [{ title: p.tracker.name, keys: subs.map((c) => "p:" + rest + "~" + c.id) }] : []),
        { title: "Goals", keys: [...goals.map((g) => "g:" + rest + ":" + g.id), "o:" + rest],
          action: { label: "Add goal", run: () => openItemSheet({ ref: rest, kind: "goal" }) } },
        { title: "Notes", keys: p.notesList.map((n) => "n:" + rest + ":" + n.id),
          empty: "No notes yet",
          action: { label: "New note", run: () => {
            const now = new Date().toISOString();
            const n = { id: uid(), text: "", createdAt: now, updatedAt: now, thread: [] };
            p.notesList.unshift(n);
            persist();
            colRevealPath(rest, ["n:" + rest + ":" + n.id]);
            const ed = app.querySelector('.col-preview [data-nsec="root"] .note-card-text');
            if (ed) ed.focus();
          } } },
        { title: "Links", keys: p.links.map((l) => "pl:" + rest + ":" + l.id),
          empty: "No links yet",
          action: { label: "Add link", run: () => openLinkSheet({ ref: rest }) } },
      ],
    };
  }
  if (kind === "g" || kind === "o") {
    const [ref, gid] = rest.split(":");
    const p = containerByRef(ref);
    if (!p) return null;
    const g = kind === "g" ? p.goals.find((x) => x.id === gid) : null;
    if (kind === "g" && !g) return null;
    const subs = (g ? p.tasks.filter((t) => t.goalId === gid) : looseTasks(p)).sort(colTaskSort);
    const open = subs.filter((t) => !t.done).length;
    return {
      title: g ? g.text : "Others",
      label: g ? g.text : "Others",
      done: g ? g.done : false,
      icon: `<span class="col-glyph ${g ? "col-goal" : "col-goal col-goal-others"}">${COL_ICONS.goal}</span>`,
      meta: open ? String(open) : "",
      folder: true,
      open: () => openSpaceTab(ref, "work"),
      sections: [{
        title: g ? "Subtasks" : "Tasks",
        keys: subs.map((t) => "t:" + ref + ":" + t.id),
        empty: g ? "No subtasks yet" : "Tasks that sit under no goal land here",
        action: { label: g ? "Add subtask" : "Add task", run: () => openItemSheet({ ref, kind: "task", goalId: g ? gid : "" }) },
      }],
    };
  }
  if (kind === "pl") {
    const [ref, lid] = rest.split(":");
    const p = containerByRef(ref);
    const l = p && p.links.find((x) => x.id === lid);
    if (!l) return null;
    let host = "";
    try { host = new URL(l.url).hostname.replace(/^www\./, ""); } catch {}
    return {
      label: l.name || host || "Link",
      icon: `<span class="col-tile col-tile-link"><img src="${linkIconSrc(l.url)}" alt="" onerror="this.style.display='none'" /></span>`,
      meta: escapeHtml(host),
      open: () => window.open(l.url, "_blank", "noopener"),
      preview: () => `
        <div class="colp">
          <div class="colp-kicker">Link · ${escapeHtml(p.name)}</div>
          <div class="colp-hero"><span class="col-tile col-tile-link col-tile-lg"><img src="${linkIconSrc(l.url)}" alt="" onerror="this.style.display='none'" /></span></div>
          <div class="colp-title">${escapeHtml(l.name || host)}</div>
          <div class="colp-sub colp-url">${escapeHtml(l.url)}</div>
          <div class="colp-actions">
            <button class="btn btn-ghost btn-sm btn-danger-ghost" data-colp-remove>Remove</button>
            <button class="btn btn-ghost btn-sm" data-colp-editlink>Edit</button>
            <button class="btn btn-primary btn-sm" data-colp-open>Open link</button>
          </div>
        </div>`,
      remove: () => { p.links = p.links.filter((x) => x.id !== lid); },
    };
  }
  if (kind === "t") {
    const [ref, tid] = rest.split(":");
    const p = containerByRef(ref);
    const t = p && p.tasks.find((x) => x.id === tid);
    if (!t) return null;
    return {
      label: t.text, task: t, ref, done: t.done,
      open: () => openSpaceTab(ref, "work"),
      preview: () => colTaskPreview(t, p, ref),
    };
  }
  if (kind === "n") {
    const [ref, nid] = rest.split(":");
    const p = containerByRef(ref);
    const n = p && p.notesList.find((x) => x.id === nid);
    if (!n) return null;
    const text = plainText(n.text);
    return {
      label: text.slice(0, 160) || "New note",
      note: n,
      icon: `<span class="col-glyph">${COL_ICONS.note}</span>`,
      meta: (n.thread && n.thread.length ? `<span class="col-thread">+${n.thread.length}</span>` : "") + shortDay(n.updatedAt || n.createdAt),
      open: () => openSpaceTab(ref, "notes"),
      preview: () => `
        <div class="colp">
          <div class="colp-kicker">Note · ${escapeHtml(p.name)}</div>
          ${noteFeedHtml(n)}
          <div class="colp-actions">
            <button class="btn btn-ghost btn-sm" data-colp-open>Open in ${escapeHtml(p.name)}</button>
          </div>
        </div>`,
      removeNote: () => { p.notesList = p.notesList.filter((x) => x.id !== nid); },
    };
  }
  if (kind === "c") {
    const c = state.collections.find((x) => x.id === rest);
    if (!c) return null;
    return {
      title: c.name, label: c.name,
      icon: `<span class="col-glyph col-coll">${COL_ICONS.folder}</span>`,
      meta: String(c.items.length), folder: true,
      open: () => (window.location.hash = "#/c/" + c.id),
      emptyText: "Empty collection",
      sections: [{ title: "", keys: c.items
        .filter((it) => it.type === "project" ? getProject(it.id) : state.links.some((l) => l.id === it.id))
        .map((it) => (it.type === "project" ? "p:" : "l:") + it.id) }],
    };
  }
  if (kind === "l") {
    const l = state.links.find((x) => x.id === rest);
    if (!l) return null;
    let host = "";
    try { host = new URL(l.url).hostname.replace(/^www\./, ""); } catch {}
    return {
      label: l.name,
      icon: `<span class="col-tile col-tile-link"><img src="${linkIconSrc(l.url)}" alt="" onerror="this.style.display='none'" /></span>`,
      meta: "",
      open: () => window.open(l.url, "_blank", "noopener"),
      preview: () => `
        <div class="colp">
          <div class="colp-hero"><span class="col-tile col-tile-link col-tile-lg"><img src="${linkIconSrc(l.url)}" alt="" onerror="this.style.display='none'" /></span></div>
          <div class="colp-title">${escapeHtml(l.name)}</div>
          <div class="colp-sub">${escapeHtml(host)}</div>
          <div class="colp-actions"><button class="btn btn-primary btn-sm" data-colp-open>Open link</button></div>
        </div>`,
    };
  }
  if (kind === "w") {
    const w = WIDGETS[rest];
    if (!w) return null;
    const items = taggedTasks(rest).filter((x) => !x.task.done);
    return {
      title: w.label, label: w.label,
      icon: `<span class="col-glyph col-widget" style="--wt:${w.tint}">${w.icon}</span>`,
      meta: items.length ? String(items.length) : "", folder: true,
      open: () => (window.location.hash = "#/w/" + rest),
      emptyText: "Nothing here",
      sections: [{ title: "", keys: items.map((x) => "t:" + x.project.id + ":" + x.task.id) }],
    };
  }
  if (kind === "people") {
    return {
      title: "People", label: "People",
      icon: `<span class="col-glyph col-widget" style="--wt:#f472b6">${ICONS.users}</span>`,
      meta: state.people.length ? String(state.people.length) : "", folder: true,
      open: () => (window.location.hash = "#/people"),
      emptyText: "No people yet",
      sections: [{ title: "", keys: state.people.slice()
        .sort((a, b) => a.name.localeCompare(b.name)).map((per) => "per:" + per.id) }],
    };
  }
  if (kind === "per") {
    const per = personById(rest);
    if (!per) return null;
    const mine = allTaskRefs().filter((x) => x.task.owner === per.id || (x.task.people || []).includes(per.id));
    mine.sort((a, b) => colTaskSort(a.task, b.task));
    const open = mine.filter((x) => !x.task.done).length;
    return {
      title: per.name, label: per.name,
      icon: `<span class="col-avatar" style="--pc:${per.color}">${escapeHtml(per.name.charAt(0).toUpperCase())}</span>`,
      meta: open ? String(open) : "", folder: true,
      open: () => (window.location.hash = "#/people"),
      emptyText: "No tasks with " + per.name.split(" ")[0],
      sections: [{ title: "", keys: mine.map((x) => "t:" + x.ref + ":" + x.task.id) }],
    };
  }
  return null;
}

function shortDay(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function openSpaceTab(ref, tab) {
  projTabFor = ref;
  projTab = tab;
  window.location.hash = "#/p/" + ref;
}

function colTaskPreview(t, p, ref) {
  const goal = t.goalId && p.goals.find((g) => g.id === t.goalId);
  const owner = isMine(t) ? "Me" : (personById(t.owner) || {}).name || "Me";
  const people = (t.people || []).map((id) => personById(id)).filter(Boolean);
  const note = plainText(t.note);
  const fact = (k, v) => v ? `<div class="colp-fact"><span>${k}</span><b>${v}</b></div>` : "";
  return `
    <div class="colp">
      <div class="colp-kicker">${escapeHtml(p.name)}${goal ? " › " + escapeHtml(goal.text) : ""}</div>
      <div class="colp-title ${t.done ? "is-done" : ""}">${escapeHtml(t.text)}</div>
      ${t.done ? `<div class="colp-chips"><span class="meta-chip">✓ Done</span></div>` : ""}
      <div class="colp-factlist">
        ${fact("Owner", escapeHtml(owner))}
        ${fact("Due", t.due ? colTaskSub({ ...t, owner: "me" }).replace('class="col-sub"', 'class="colp-due"') : "")}
        ${fact("With", people.map((x) => escapeHtml(x.name)).join(", "))}
        ${fact("Added", t.createdAt ? escapeHtml(fmtDT(t.createdAt)) : "")}
        ${fact("Closed", t.done && t.closedAt ? escapeHtml(fmtDT(t.closedAt)) : "")}
      </div>
      ${note ? `<div class="colp-note colp-note-sm">${noteBodyHtml(t.note)}</div>` : ""}
      ${t.link ? `<a class="colp-link" href="${escapeHtml(t.link)}" target="_blank" rel="noopener">Link<span>${escapeHtml(t.link)}</span></a>` : ""}
      <div class="colp-actions">
        <button class="btn btn-primary btn-sm" data-colp-toggle>${t.done ? "Reopen" : "Mark done"}</button>
        <button class="btn btn-ghost btn-sm" data-colp-edititem>Edit</button>
        <button class="btn btn-ghost btn-sm" data-colp-open>Open in ${escapeHtml(p.name)}</button>
        <button class="colp-delete" data-colp-delete>Delete</button>
      </div>
    </div>`;
}

function colSpacePreview(p, ref) {
  const st = spaceStats(p);
  const isSub = ref.includes("~");
  const accent = isSub ? kcolor(p.name) : accentFor(ref);
  const stat = (n, label) => `<div class="colp-stat"><b>${n}</b><span>${label}</span></div>`;
  return `
    <div class="colp">
      <div class="colp-hero"><span class="col-tile col-tile-lg" style="--pa:${accent}">${escapeHtml(initials(p.name))}</span></div>
      <div class="colp-title">${escapeHtml(p.name)}</div>
      ${p.description ? `<div class="colp-sub">${escapeHtml(p.description)}</div>` : ""}
      <div class="colp-stats">
        ${stat(st.open, "open tasks")}
        ${stat(st.goals, "goals")}
        ${stat(st.notes, "notes")}
        ${st.subs ? stat(st.subs, escapeHtml((p.tracker.name || "tracker").toLowerCase())) : ""}
      </div>
      ${st.over ? `<div class="colp-warn">${st.over} overdue</div>` : ""}
      <div class="colp-actions"><button class="btn btn-primary btn-sm" data-colp-open>Open space</button></div>
    </div>`;
}

/* drop path entries that no longer resolve (deleted, archived, moved) */
function validColPath() {
  const out = [];
  let parent = colNode("root");
  for (const key of colPath) {
    if (!parent || !parent.sections) break;
    const listed = parent.sections.some((s) => s.keys.includes(key));
    const node = listed && colNode(key);
    if (!node) break;
    out.push(key);
    parent = node.folder ? node : null;
  }
  return out;
}

/* one quiet line under a task: when it's due, and who has it */
function colTaskSub(t) {
  const parts = [];
  if (t.due) {
    const d = dueDelta(t.due);
    const cls = t.done ? "" : d < 0 ? "sub-over" : d === 0 ? "sub-today" : d <= 2 ? "sub-soon" : "";
    parts.push(`<span class="${cls}">${!t.done && d < 0 ? "Overdue · " : ""}${escapeHtml(dueLabel(t.due))}</span>`);
  }
  if (!isMine(t)) {
    const per = personById(t.owner);
    if (per) parts.push(`<span class="sub-owner" style="--pc:${per.color}">${escapeHtml(per.name.split(" ")[0])}</span>`);
  }
  return parts.length ? `<span class="col-sub">${parts.join("")}</span>` : "";
}

function colRowHtml(key, selected, depth) {
  const n = colNode(key);
  if (!n) return "";
  const lead = n.task
    ? `<button class="col-check ${n.done ? "done" : ""}" data-col-check="${escapeHtml(key)}" aria-label="${n.done ? "Reopen" : "Mark done"}"></button>`
    : n.icon || "";
  const trail = n.task ? "" : `${n.meta ? `<span class="col-meta">${n.meta}</span>` : ""}`;
  const sub = n.task ? colTaskSub(n.task) : "";
  return `
    <div class="col-row ${selected ? "selected" : ""} ${n.done ? "is-done" : ""} ${n.task ? "is-task" : ""}"
         data-col-key="${escapeHtml(key)}" data-col-depth="${depth}" tabindex="-1" role="option" aria-selected="${selected}">
      ${lead}
      ${sub ? `<span class="col-text"><span class="col-label">${escapeHtml(n.label)}</span>${sub}</span>`
            : `<span class="col-label">${escapeHtml(n.label)}</span>`}
      ${trail ? `<span class="col-trail">${trail}</span>` : ""}
      ${colTarget(key) ? `<button class="col-more" data-col-more="${escapeHtml(key)}" aria-label="More actions" title="More">${MORE_SVG}</button>` : `<span class="col-more col-more-blank" aria-hidden="true"></span>`}
      ${n.folder ? `<span class="col-chev">${CHEVRON_R}</span>` : ""}
    </div>`;
}

function columnsHtml() {
  colPath = validColPath();
  const cols = [];
  let node = colNode("root");
  let depth = 0;
  const keys = ["root", ...colPath];
  while (node && node.sections) {
    const sel = colPath[depth];
    const body = node.sections.map((s, si) => (s.keys.length || s.action) ? `
      ${s.title || s.action ? `<div class="col-section">
        <span>${escapeHtml(s.title || "")}</span>
        ${s.action ? `<button class="col-add" data-col-action="${escapeHtml(keys[depth])}|${si}">${ICONS.plus}<span>${escapeHtml(s.action.label)}</span></button>` : ""}
      </div>` : ""}
      ${s.keys.map((k) => colRowHtml(k, k === sel, depth)).join("")}
      ${!s.keys.length && s.empty ? `<div class="col-hint">${escapeHtml(s.empty)}</div>` : ""}
    ` : "").join("");
    cols.push(`
      <div class="col ${depth === colPath.length - 1 ? "col-active" : ""}" data-col="${depth}" role="listbox" aria-label="${escapeHtml(node.title || "")}">
        <div class="col-head"><span>${escapeHtml(node.title || "")}</span>
          <span class="col-head-actions">
            ${depth > 0 && colMenu(keys[depth]).length ? `<button class="col-more col-more-head" data-col-more="${escapeHtml(keys[depth])}" aria-label="More actions" title="More">${MORE_SVG}</button>` : ""}
            ${depth > 0 && node.open ? `<button class="col-head-open" data-col-open="${escapeHtml(keys[depth])}" title="Open">Open ${CHEVRON_R}</button>` : ""}
          </span>
        </div>
        <div class="col-body">${body.trim() ? body : `<div class="col-empty">${escapeHtml(node.emptyText || "Empty")}</div>`}</div>
      </div>`);
    if (!sel) break;
    const next = colNode(sel);
    depth++;
    if (next.folder) { node = next; continue; }
    node = null;
  }
  // a selected leaf (task/note/link), or a selected space, gets a preview column
  const last = colPath[colPath.length - 1];
  const lastNode = last && colNode(last);
  let preview = "";
  if (lastNode && lastNode.preview && !lastNode.folder) preview = lastNode.preview();
  else if (lastNode && lastNode.preview && lastNode.folder && !hasChildren(lastNode)) preview = lastNode.preview();
  else if (last && last.startsWith("p:") && !hasChildren(lastNode)) {
    const ref = colSplit(last)[1];
    preview = colSpacePreview(containerByRef(ref), ref);
  }
  if (!preview && !colPath.length && !IS_MOBILE) preview = colUpNextHtml();
  if (preview) cols.push(`<div class="col col-preview ${colPath.length ? "" : "col-upnext"}" data-col="${depth}">${preview}</div>`);

  const crumbs = keys.map((k) => (colNode(k) || {}).title || (colNode(k) || {}).label || "");
  const backTitle = crumbs.length > 1 ? crumbs[crumbs.length - 2] : "";
  const curTitle = lastNode ? (lastNode.title || lastNode.label) : "Home";
  return `
    <div class="columns ${state.timebarHidden ? "" : "with-timebar"}" data-columns>
      <div class="cols-mbar">
        ${colPath.length ? `<button class="cols-back" data-cols-back aria-label="Back to ${escapeHtml(backTitle)}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg><span>${escapeHtml(backTitle.length > 14 ? "Back" : backTitle)}</span></button>` : ""}
        <span class="cols-mtitle">${escapeHtml(curTitle)}</span>
        ${last && colMenu(last).length ? `<button class="col-more cols-mmore" data-col-more="${escapeHtml(last)}" aria-label="More actions">${MORE_SVG}</button>` : ""}
      </div>
      <div class="cols-scroll" data-cols-scroll>${cols.join("")}</div>
    </div>`;
}

/* nothing picked yet: what needs you next, across every space */
function colUpNextHtml() {
  const items = allTaskRefs()
    .filter(({ task }) => !task.done && task.due && dueDelta(task.due) <= 7)
    .sort((a, b) => a.task.due.localeCompare(b.task.due))
    .slice(0, 8);
  const d = new Date();
  const rows = items.map(({ task, ref, space }) => {
    const tail = [task.goalId ? `g:${ref}:${task.goalId}` : `o:${ref}`, `t:${ref}:${task.id}`];
    return `<button class="upnext-row" data-upnext="${escapeHtml(ref)}" data-upnext-tail="${escapeHtml(tail.join("|"))}">
      <span class="upnext-text">${escapeHtml(task.text)}</span>
      <span class="upnext-space">${escapeHtml(space.node.name)}</span>
      ${colTaskSub({ ...task, owner: "me" })}
    </button>`;
  }).join("");
  return `
    <div class="colp upnext">
      <div class="colp-kicker">${escapeHtml(d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }))}</div>
      <div class="colp-title">Up next</div>
      ${rows ? `<div class="upnext-list">${rows}</div>` : `<p class="upnext-empty">Nothing due this week. Pick a space on the left to begin.</p>`}
    </div>`;
}

function hasChildren(n) {
  return !!(n && n.sections && n.sections.some((s) => s.keys.length));
}

function redrawColumns(focusKey) {
  const el = app.querySelector("[data-columns]");
  if (!el) return;
  const prevScroll = el.querySelector("[data-cols-scroll]");
  const tops = {};
  prevScroll.querySelectorAll(".col").forEach((c) => {
    const b = c.querySelector(".col-body");
    if (b) tops[c.dataset.col] = b.scrollTop;
  });
  el.outerHTML = columnsHtml();
  const fresh = app.querySelector("[data-columns]");
  fresh.querySelectorAll(".col").forEach((c) => {
    const b = c.querySelector(".col-body");
    if (b && tops[c.dataset.col] != null) b.scrollTop = tops[c.dataset.col];
  });
  const sc = fresh.querySelector("[data-cols-scroll]");
  sc.scrollLeft = sc.scrollWidth;
  wireColumns();
  if (focusKey) {
    const row = fresh.querySelector(`[data-col-key="${CSS.escape(focusKey)}"]`);
    if (row) { row.focus({ preventScroll: true }); row.scrollIntoView({ block: "nearest" }); }
  }
}

function colSelect(depth, key) {
  colPath = [...colPath.slice(0, depth), key];
  saveColPath();
  redrawColumns(key);
}

function colToggleTask(key) {
  const n = colNode(key);
  if (!n || !n.task) return;
  n.task.done = !n.task.done;
  n.task.closedAt = n.task.done ? new Date().toISOString() : null;
  persist();
  redrawColumns(key);
}

function wireColumns() {
  const root = app.querySelector("[data-columns]");
  if (!root) return;
  root.querySelectorAll("[data-upnext]").forEach((btn) => {
    btn.addEventListener("click", () => colRevealPath(btn.dataset.upnext, btn.dataset.upnextTail.split("|")));
  });
  root.querySelectorAll("[data-col-key]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-col-check], [data-col-more], .col-rename")) return;
      colSelect(+row.dataset.colDepth, row.dataset.colKey);
    });
    row.addEventListener("dblclick", (e) => {
      if (e.target.closest("[data-col-check]")) return;
      const n = colNode(row.dataset.colKey);
      if (n && n.open) n.open();
    });
  });
  root.querySelectorAll("[data-col-more]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (b.classList.contains("open")) { closeColMenu(); return; }
      openColMenu(b.dataset.colMore, b);
    });
    b.addEventListener("dblclick", (e) => e.stopPropagation());
  });
  root.querySelectorAll("[data-col-key]").forEach((row) => row.addEventListener("contextmenu", (e) => {
    if (!colMenu(row.dataset.colKey).length) return;
    e.preventDefault();
    openColMenu(row.dataset.colKey, null, { x: e.clientX, y: e.clientY });
  }));
  root.querySelectorAll("[data-col-check]").forEach((b) =>
    b.addEventListener("click", (e) => { e.stopPropagation(); colToggleTask(b.dataset.colCheck); }));
  const last = colPath[colPath.length - 1];
  const lastNode = last && colNode(last);
  root.querySelectorAll("[data-colp-open], [data-cols-open]").forEach((b) =>
    b.addEventListener("click", () => lastNode && lastNode.open && lastNode.open()));
  root.querySelectorAll("[data-col-open]").forEach((b) =>
    b.addEventListener("click", () => { const n = colNode(b.dataset.colOpen); if (n && n.open) n.open(); }));
  root.querySelectorAll("[data-col-action]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    const [key, si] = b.dataset.colAction.split("|");
    const n = colNode(key);
    const act = n && n.sections[+si] && n.sections[+si].action;
    if (act) act.run();
  }));
  root.querySelector("[data-colp-remove]")?.addEventListener("click", () => colDelete(last));
  root.querySelector("[data-colp-editlink]")?.addEventListener("click", () => {
    const t = colTarget(last);
    if (t) openLinkSheet({ ref: colSplit(last)[1].split(":")[0], link: t.obj });
  });
  if (lastNode && lastNode.note) {
    const note = lastNode.note;
    const refresh = () => {
      const row = root.querySelector(`[data-col-key="${CSS.escape(last)}"]`);
      const n = colNode(last);
      if (!row || !n) return;
      row.querySelector(".col-label").textContent = n.label;
      const meta = row.querySelector(".col-meta");
      if (meta) meta.innerHTML = n.meta;
    };
    wireNoteFeed(root.querySelector(".col-preview [data-nfeed]"), note, {
      onChange: refresh,
      onRootDelete: () => showConfirm({ title: "Delete note?", message: "The note and everything added to it will be removed." }, () => {
        lastNode.removeNote();
        persist();
        colPath = colPath.slice(0, -1);
        saveColPath();
        redrawColumns(colPath[colPath.length - 1]);
      }),
    });
    // a brand-new note left completely empty doesn't linger
    const rootEd = root.querySelector('.col-preview [data-nsec="root"] .note-card-text');
    rootEd?.addEventListener("blur", () => setTimeout(() => {
      if (!document.body.contains(rootEd)) return;
      if (!note.text && !(note.thread || []).length && !root.querySelector(".col-preview").contains(document.activeElement)) {
        lastNode.removeNote();
        persist();
      }
    }, 0));
    rootEd?.addEventListener("input", () => {
      const row = root.querySelector(`[data-col-key="${CSS.escape(last)}"] .col-label`);
      if (row) row.textContent = plainText(rootEd.innerHTML).slice(0, 160) || "New note";
    });
  }
  root.querySelector("[data-colp-delete]")?.addEventListener("click", () => colDelete(last));
  root.querySelector("[data-colp-edititem]")?.addEventListener("click", () => {
    const t = colTarget(last);
    if (t) openItemSheet({ ref: t.ref, kind: "task", item: t.obj });
  });
  root.querySelector("[data-colp-toggle]")?.addEventListener("click", () => colToggleTask(last));
  root.querySelector("[data-cols-back]")?.addEventListener("click", () => {
    colPath = colPath.slice(0, -1);
    saveColPath();
    redrawColumns(colPath[colPath.length - 1]);
  });
}

/* Finder keys: ↑↓ move, → opens a folder, ← steps back, Enter/⌘↓ opens, Space toggles a task */
document.addEventListener("keydown", (e) => {
  if (!app.querySelector("[data-columns]")) return;
  if (app.querySelector(".window-backdrop, .projectpage")) return;
  if (e.target.closest && e.target.closest("input, textarea, [contenteditable=true]")) return;
  if (e.metaKey && e.key === "Backspace") {
    const sel = colPath[colPath.length - 1];
    if (sel && colTarget(sel) && colTarget(sel).remove) { e.preventDefault(); colDelete(sel); }
    return;
  }
  if (e.metaKey && e.key !== "ArrowDown") return;
  const depth = Math.max(0, colPath.length - 1);
  const col = app.querySelector(`.col[data-col="${depth}"]`);
  const rows = col ? [...col.querySelectorAll("[data-col-key]")] : [];
  const cur = colPath[depth];
  const idx = rows.findIndex((r) => r.dataset.colKey === cur);
  if (e.key === "ArrowDown" && !e.metaKey || e.key === "ArrowUp") {
    e.preventDefault();
    if (!rows.length) return;
    const next = idx < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, idx + (e.key === "ArrowDown" ? 1 : -1)));
    colSelect(depth, rows[next].dataset.colKey);
  } else if (e.key === "ArrowRight") {
    const n = cur && colNode(cur);
    const child = n && n.folder && n.sections.flatMap((s) => s.keys)[0];
    if (child) { e.preventDefault(); colSelect(depth + 1, child); }
  } else if (e.key === "ArrowLeft") {
    if (colPath.length > 1) { e.preventDefault(); colPath = colPath.slice(0, -1); saveColPath(); redrawColumns(colPath[colPath.length - 1]); }
  } else if (e.key === "Enter" || (e.metaKey && e.key === "ArrowDown")) {
    const n = cur && colNode(cur);
    if (n && n.open) { e.preventDefault(); n.open(); }
  } else if (e.key === " ") {
    const n = cur && colNode(cur);
    if (n && n.task) { e.preventDefault(); colToggleTask(cur); }
  }
});


/* ---------- note threads: a note grows section by section ----------
   note.thread = [{ id, text(html), createdAt, updatedAt }], oldest first.
   Shown newest first under an "Add" button at the top, the way the
   Notes feed always worked: click, a fresh section appears, type. */

const NOTE_TOOLS = `
  <div class="note-tools-mini">
    <button class="fmt-btn" data-cmd="bold" title="Bold"><b>B</b></button>
    <button class="fmt-btn" data-cmd="italic" title="Italic"><i>I</i></button>
    <button class="fmt-btn" data-cmd="underline" title="Underline"><u>U</u></button>
    <button class="fmt-btn" data-cmd="insertUnorderedList" title="Bullet list">&bull; List</button>
  </div>`;

function noteSectionHtml(entry, isRoot) {
  return `
    <div class="note-card nsec ${isRoot ? "nsec-root" : ""}" data-nsec="${isRoot ? "root" : entry.id}">
      <div class="note-card-text" contenteditable="true" data-ph="${isRoot ? "Write..." : "Add to this note..."}">${noteBodyHtml(entry.text)}</div>
      <div class="note-card-foot">
        ${NOTE_TOOLS}
        <span class="note-date">${isRoot ? "" : `<span class="nsec-tag">Update</span>`}${noteStampHtml(entry)}</span>
        <button class="action-btn item-delete" data-nsec-del title="${isRoot ? "Delete note" : "Delete section"}">&times;</button>
      </div>
    </div>`;
}

/* full feed for the columns preview: add button, newest section first, the note itself last */
function noteFeedHtml(note) {
  const list = note.thread || [];
  return `
    <div class="nfeed" data-nfeed>
      <button class="crow crow-add note-add" data-nfeed-add>+ Add to this note</button>
      ${list.slice().reverse().map((e) => noteSectionHtml(e, false)).join("")}
      ${noteSectionHtml(note, true)}
    </div>`;
}

/* compact thread inside a Notes-tab card: the card itself is the note */
function threadHtml(note) {
  const list = note.thread || [];
  return `
    <div class="nthread" data-nfeed>
      <button class="nthread-add" data-nfeed-add>+ Add to this note</button>
      ${list.slice().reverse().map((e) => noteSectionHtml(e, false)).join("")}
    </div>`;
}

/* wires a [data-nfeed]. opts: onRootDelete(), onChange() */
function wireNoteFeed(feed, note, opts = {}) {
  if (!feed) return;
  if (!note.thread) note.thread = [];

  function wireSection(card) {
    const isRoot = card.dataset.nsec === "root";
    const entry = isRoot ? note : note.thread.find((e) => e.id === card.dataset.nsec);
    if (!entry) return;
    const ed = card.querySelector(".note-card-text");
    const save = () => {
      const next = ed.textContent.trim() ? ed.innerHTML : "";
      if (next === (entry.text || "")) return;
      entry.text = next;
      entry.updatedAt = new Date().toISOString();
      if (!isRoot) note.updatedAt = entry.updatedAt;
      persist();
      const stamp = card.querySelector(".note-date");
      if (stamp) stamp.innerHTML = (isRoot ? "" : `<span class="nsec-tag">Update</span>`) + noteStampHtml(entry);
      if (opts.onChange) opts.onChange();
    };
    let timer = null;
    ed.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(save, 500); });
    ed.addEventListener("keydown", (e) => e.stopPropagation());
    ed.addEventListener("blur", () => {
      clearTimeout(timer);
      save();
      // an update left empty simply disappears
      if (!isRoot && !ed.textContent.trim()) {
        note.thread = note.thread.filter((x) => x.id !== entry.id);
        persist();
        card.remove();
        if (opts.onChange) opts.onChange();
      }
    });
    card.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("mousedown", (e) => {
      e.preventDefault();
      document.execCommand(b.dataset.cmd, false, null);
      save();
    }));
    card.querySelector("[data-nsec-del]").addEventListener("click", () => {
      if (isRoot) { if (opts.onRootDelete) opts.onRootDelete(); return; }
      if (!ed.textContent.trim()) {
        note.thread = note.thread.filter((x) => x.id !== entry.id);
        persist(); card.remove(); return;
      }
      showConfirm({ title: "Delete section?", message: "This removes it from the note." }, () => {
        note.thread = note.thread.filter((x) => x.id !== entry.id);
        persist();
        card.remove();
        if (opts.onChange) opts.onChange();
      });
    });
  }

  feed.querySelectorAll(":scope > [data-nsec]").forEach(wireSection);
  const add = feed.querySelector("[data-nfeed-add]");
  add.addEventListener("click", () => {
    const now = new Date().toISOString();
    const e = { id: uid(), text: "", createdAt: now, updatedAt: now };
    note.thread.push(e);
    persist();
    const card = elFromHtml(noteSectionHtml(e, false));
    add.after(card);
    wireSection(card);
    card.querySelector(".note-card-text").focus();
  });
}

function autoGrow(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
}

/* ---------- edit anything in the columns ----------
   every row has a ⋯ menu (also right-click); column headers carry one for
   the thing that column belongs to. Rename happens inline, Finder-style. */

/* what a key points at: the object, the field holding its name, how to remove it */
function colTarget(key) {
  const [kind, rest] = colSplit(key);
  if (kind === "p") {
    const p = containerByRef(rest);
    if (!p) return null;
    const isSub = rest.includes("~");
    return {
      obj: p, field: "name", noun: isSub ? "sub-project" : "space",
      remove: () => {
        if (isSub) {
          const parent = containerByRef(parentRefOf(rest));
          parent.tracker.items = parent.tracker.items.filter((c) => c.id !== p.id);
        } else {
          state.projects = state.projects.filter((x) => x.id !== p.id);
          state.collections.forEach((c) => { c.items = c.items.filter((i) => !(i.type === "project" && i.id === p.id)); });
          state.archived = state.archived.filter((a) => !(a.type === "project" && a.id === p.id));
        }
      },
      confirmMsg: `Delete "${p.name}" with all its goals, tasks, notes and links? This can't be undone.`,
    };
  }
  if (kind === "g") {
    const [ref, gid] = rest.split(":");
    const p = containerByRef(ref);
    const g = p && p.goals.find((x) => x.id === gid);
    if (!g) return null;
    const subs = p.tasks.filter((t) => t.goalId === gid).length;
    return {
      obj: g, field: "text", noun: "goal", p, ref,
      remove: () => {
        p.goals = p.goals.filter((x) => x.id !== gid);
        p.tasks.forEach((t) => { if (t.goalId === gid) delete t.goalId; });
      },
      confirmMsg: subs
        ? `Delete "${g.text}"? Its ${subs} subtask${subs === 1 ? "" : "s"} move to Others.`
        : `Delete "${g.text}"?`,
    };
  }
  if (kind === "t") {
    const [ref, tid] = rest.split(":");
    const p = containerByRef(ref);
    const t = p && p.tasks.find((x) => x.id === tid);
    if (!t) return null;
    return {
      obj: t, field: "text", noun: "task", p, ref,
      remove: () => { p.tasks = p.tasks.filter((x) => x.id !== tid); },
      confirmMsg: `Delete "${t.text}"?`,
    };
  }
  if (kind === "n") {
    const [ref, nid] = rest.split(":");
    const p = containerByRef(ref);
    const n = p && p.notesList.find((x) => x.id === nid);
    if (!n) return null;
    return {
      obj: n, noun: "note",
      remove: () => { p.notesList = p.notesList.filter((x) => x.id !== nid); },
      confirmMsg: "Delete this note and everything added to it?",
    };
  }
  if (kind === "pl") {
    const [ref, lid] = rest.split(":");
    const p = containerByRef(ref);
    const l = p && p.links.find((x) => x.id === lid);
    if (!l) return null;
    return {
      obj: l, field: "name", noun: "link", link: true,
      remove: () => { p.links = p.links.filter((x) => x.id !== lid); },
      confirmMsg: `Remove "${l.name}" from ${p.name}?`,
    };
  }
  if (kind === "l") {
    const l = state.links.find((x) => x.id === rest);
    if (!l) return null;
    return {
      obj: l, field: "name", noun: "link", link: true,
      remove: () => {
        state.links = state.links.filter((x) => x.id !== rest);
        state.collections.forEach((c) => { c.items = c.items.filter((i) => !(i.type === "link" && i.id === rest)); });
        state.archived = state.archived.filter((a) => !(a.type === "link" && a.id === rest));
      },
      confirmMsg: `Delete "${l.name}"?`,
    };
  }
  if (kind === "c") {
    const c = state.collections.find((x) => x.id === rest);
    if (!c) return null;
    return {
      obj: c, field: "name", noun: "collection",
      remove: () => {
        state.collections = state.collections.filter((x) => x.id !== rest);
        state.archived = state.archived.filter((a) => !(a.type === "collection" && a.id === rest));
      },
      confirmMsg: `Delete "${c.name}"? What's inside moves back to Home.`,
    };
  }
  if (kind === "per") {
    const per = personById(rest);
    return per ? { obj: per, field: "name", noun: "person" } : null;
  }
  return null;
}

function colMenu(key) {
  const [kind, rest] = colSplit(key);
  const t = colTarget(key);
  const node = colNode(key);
  const items = [];
  if (!t && !node) return items;
  if (node && node.open) items.push({ label: kind === "l" || kind === "pl" ? "Open link" : "Open", run: () => node.open() });
  if (t && t.field) items.push({ label: "Rename", run: () => colRename(key) });
  if (kind === "t") {
    items.push({ label: "Edit details…", run: () => openItemSheet({ ref: t.ref, kind: "task", item: t.obj }) });
    items.push({ label: t.obj.done ? "Mark not done" : "Mark done", run: () => colToggleTask(key) });
  }
  if (kind === "g") {
    items.push({ label: "Edit details…", run: () => openItemSheet({ ref: t.ref, kind: "goal", item: t.obj }) });
    items.push({ label: "Add subtask", run: () => openItemSheet({ ref: t.ref, kind: "task", goalId: t.obj.id }) });
    items.push({ label: t.obj.done ? "Mark not done" : "Mark done", run: () => {
      t.obj.done = !t.obj.done;
      t.obj.closedAt = t.obj.done ? new Date().toISOString() : null;
      persist(); redrawColumns(key);
    } });
  }
  if (kind === "o") items.push({ label: "Add task", run: () => openItemSheet({ ref: rest, kind: "task", goalId: "" }) });
  if (t && t.link) items.push({ label: "Edit link…", run: () => openLinkSheet({ ref: kind === "pl" ? rest.split(":")[0] : null, link: t.obj }) });
  if (kind === "p" && !rest.includes("~")) {
    items.push({ sep: true });
    items.push({ label: "Archive", run: () => {
      state.archived.push({ type: "project", id: rest });
      persist(); colDropFromPath(key);
    } });
  }
  if (kind === "c") {
    items.push({ sep: true });
    items.push({ label: "Archive", run: () => {
      state.archived.push({ type: "collection", id: rest });
      persist(); colDropFromPath(key);
    } });
  }
  if (t && t.remove) {
    if (!items.length || !items[items.length - 1].sep) items.push({ sep: true });
    items.push({ label: kind === "pl" ? "Remove" : "Delete", danger: true, run: () => colDelete(key) });
  }
  return items;
}

/* forget a key (and everything after it) in the open path */
function colDropFromPath(key) {
  const i = colPath.indexOf(key);
  if (i >= 0) colPath = colPath.slice(0, i);
  saveColPath();
  redrawColumns(colPath[colPath.length - 1]);
}

function colDelete(key) {
  const t = colTarget(key);
  if (!t || !t.remove) return;
  showConfirm({ title: `Delete ${t.noun}?`, message: t.confirmMsg, confirmLabel: colSplit(key)[0] === "pl" ? "Remove" : "Delete" }, () => {
    t.remove();
    persist();
    colDropFromPath(key);
  });
}

/* inline rename in the row when it's on screen, a small sheet otherwise (phones) */
function colRename(key) {
  const t = colTarget(key);
  if (!t || !t.field) return;
  const commit = (val) => {
    const v = val.trim();
    if (v && v !== t.obj[t.field]) { t.obj[t.field] = v; persist(); }
    redrawColumns(key);
  };
  const long = t.field === "text";
  const sheet = sheetOpen({
    title: `Rename ${t.noun}`,
    body: long
      ? `<textarea class="sheet-text" rows="2" data-sheet-name maxlength="400"></textarea>`
      : `<input type="text" data-sheet-name maxlength="200" />`,
    primary: "Save",
  });
  if (!sheet) return;
  const input = sheet.el.querySelector("[data-sheet-name]");
  input.value = t.obj[t.field] || "";
  if (long) { autoGrow(input); input.addEventListener("input", () => autoGrow(input)); }
  input.focus(); input.select();
  const done = () => { sheet.close(); commit(input.value); };
  sheet.el.querySelector("[data-sheet-ok]").addEventListener("click", done);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); done(); } });
}

/* the floating ⋯ menu */
function closeColMenu() {
  document.querySelectorAll(".col-menu").forEach((m) => m.remove());
  document.querySelectorAll(".col-more.open").forEach((b) => b.classList.remove("open"));
}

function openColMenu(key, anchor, at) {
  closeColMenu();
  const items = colMenu(key);
  if (!items.length) return;
  const m = document.createElement("div");
  m.className = "col-menu";
  m.setAttribute("role", "menu");
  m.innerHTML = items.map((it, i) => it.sep
    ? `<div class="col-menu-sep"></div>`
    : `<button class="col-menu-item ${it.danger ? "danger" : ""}" role="menuitem" data-mi="${i}">${escapeHtml(it.label)}</button>`).join("");
  document.body.appendChild(m);
  const r = at || (anchor ? anchor.getBoundingClientRect() : { left: 20, bottom: 20, top: 20, right: 20 });
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let x = at ? at.x : r.right - mw;
  let y = at ? at.y : r.bottom + 4;
  if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
  if (x < 8) x = 8;
  if (y + mh > window.innerHeight - 8) y = Math.max(8, (at ? at.y : r.top) - mh - 4);
  m.style.left = x + "px";
  m.style.top = y + "px";
  if (anchor) anchor.classList.add("open");
  m.querySelectorAll("[data-mi]").forEach((b) => b.addEventListener("click", () => {
    closeColMenu();
    items[+b.dataset.mi].run();
  }));
  const first = m.querySelector("[data-mi]");
  if (first) first.focus({ preventScroll: true });
  m.addEventListener("keydown", (e) => {
    const btns = [...m.querySelectorAll("[data-mi]")];
    const i = btns.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeColMenu(); }
    e.stopPropagation();
  });
  setTimeout(() => {
    const off = (e) => {
      if (m.contains(e.target)) return;
      closeColMenu();
      document.removeEventListener("pointerdown", off, true);
    };
    document.addEventListener("pointerdown", off, true);
  }, 0);
}

const MORE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg>';

/* ---------- add / edit sheets used by the columns ----------
   one calm modal per thing you create: a goal, a task, a note, a link */

function sheetOpen({ kicker, title, body, primary, more, del }) {
  if (app.querySelector(".window-backdrop")) return null;
  const backdrop = document.createElement("div");
  backdrop.className = "window-backdrop";
  backdrop.innerHTML = `
    <div class="new-form sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      ${kicker ? `<div class="sheet-kicker">${kicker}</div>` : ""}
      <h3>${escapeHtml(title)}</h3>
      ${body}
      <div class="sheet-foot">
        ${more ? `<label class="sheet-more"><input type="checkbox" data-sheet-more /> <span>Add another</span></label>` : ""}
        ${del ? `<button class="btn btn-ghost btn-danger-ghost sheet-del" data-sheet-del>Delete</button>` : ""}
        <span class="sheet-flash" data-sheet-flash></span>
        <button class="btn btn-ghost" data-sheet-cancel>Cancel</button>
        <button class="btn btn-primary" data-sheet-ok>${escapeHtml(primary)}</button>
      </div>
    </div>`;
  app.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector("[data-sheet-cancel]").addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  return { el: backdrop, close };
}

/* path to a space as it is open in the columns, then whatever comes after */
function colRevealPath(ref, tail) {
  const i = colPath.indexOf("p:" + ref);
  let base;
  if (i >= 0) base = colPath.slice(0, i + 1);
  else {
    const parts = ref.split("~");
    base = parts.map((_, j) => "p:" + parts.slice(0, j + 1).join("~"));
  }
  colPath = [...base, ...tail];
  saveColPath();
  redrawColumns(tail[tail.length - 1]);
}

function openItemSheet({ ref, kind, goalId = "", item: editing = null }) {
  const p = containerByRef(ref);
  if (!p) return;
  const isGoal = kind === "goal";
  if (editing && !isGoal) goalId = editing.goalId && p.goals.some((g) => g.id === editing.goalId) ? editing.goalId : "";
  const goal = goalId && p.goals.find((g) => g.id === goalId);
  const goalOpts = p.goals.filter((g) => !g.done || g.id === goalId);
  let tag = editing ? editing.tag || null : null;
  const body = `
    <textarea class="sheet-text" rows="2" data-sheet-text placeholder="${isGoal ? "What do you want to achieve?" : "What needs doing?"}"></textarea>
    <div class="sheet-grid">
      ${isGoal ? "" : `
      <label class="sheet-field sheet-field-wide"><span>Under</span>
        <select data-sheet-goal>
          ${goalOpts.map((g) => `<option value="${g.id}" ${g.id === goalId ? "selected" : ""}>${escapeHtml(g.text)}</option>`).join("")}
          <option value="" ${goalId ? "" : "selected"}>Others</option>
        </select>
      </label>`}
      <label class="sheet-field"><span>Owner</span>
        <select data-sheet-owner>
          <option value="">Me</option>
          ${state.people.slice().sort((a, b) => a.name.localeCompare(b.name)).map((per) => `<option value="${per.id}" ${editing && editing.owner === per.id ? "selected" : ""}>${escapeHtml(per.name)}</option>`).join("")}
        </select>
      </label>
      <label class="sheet-field"><span>Due</span><input type="date" data-sheet-due value="${editing && editing.due ? editing.due : ""}" /></label>
    </div>
    ${isGoal ? "" : `
    <div class="sheet-tags"><span>List</span>
      ${Object.keys(WIDGETS).map((t) => `<button type="button" class="tag-btn ${tag === t ? "active" : ""}" data-sheet-tag="${t}" style="--wt:${WIDGETS[t].tint}" title="${WIDGETS[t].label}" aria-pressed="${tag === t}">${WIDGETS[t].icon}</button>`).join("")}
    </div>`}`;
  const sheet = sheetOpen({
    kicker: escapeHtml(p.name) + (goal ? " › " + escapeHtml(goal.text) : !isGoal && !goalId ? " › Others" : ""),
    title: editing ? (isGoal ? "Edit goal" : "Edit task") : isGoal ? "New goal" : goal ? "New subtask" : "New task",
    body, primary: editing ? "Save" : isGoal ? "Add goal" : "Add", more: !editing,
    del: !!editing,
  });
  if (!sheet) return;
  const $ = (q) => sheet.el.querySelector(q);
  const text = $("[data-sheet-text]");
  if (editing) { text.value = editing.text; autoGrow(text); }
  text.focus();
  if (editing) {
    $("[data-sheet-del]").addEventListener("click", () => {
      sheet.close();
      colDelete((isGoal ? "g:" : "t:") + ref + ":" + editing.id);
    });
  }
  text.addEventListener("input", () => autoGrow(text));
  sheet.el.querySelectorAll("[data-sheet-tag]").forEach((b) => b.addEventListener("click", () => {
    tag = tag === b.dataset.sheetTag ? null : b.dataset.sheetTag;
    sheet.el.querySelectorAll("[data-sheet-tag]").forEach((x) => {
      x.classList.toggle("active", x.dataset.sheetTag === tag);
      x.setAttribute("aria-pressed", x.dataset.sheetTag === tag);
    });
  }));

  function submit() {
    const t = text.value.trim();
    if (!t) { text.focus(); return; }
    if (editing) {
      editing.text = t;
      const owner = $("[data-sheet-owner]").value;
      const due = $("[data-sheet-due]").value;
      if (owner) editing.owner = owner; else delete editing.owner;
      if (due) editing.due = due; else delete editing.due;
      let tail;
      if (isGoal) tail = ["g:" + ref + ":" + editing.id];
      else {
        const gid = $("[data-sheet-goal]").value;
        if (gid) editing.goalId = gid; else delete editing.goalId;
        if (tag) editing.tag = tag; else delete editing.tag;
        tail = [gid ? "g:" + ref + ":" + gid : "o:" + ref, "t:" + ref + ":" + editing.id];
      }
      persist();
      sheet.close();
      // tasks reached through a list (Calls, a person…) stay where they were
      if (colPath.includes("p:" + ref)) colRevealPath(ref, tail);
      else redrawColumns(colPath[colPath.length - 1]);
      return;
    }
    const item = { id: uid(), text: t, done: false, createdAt: new Date().toISOString() };
    const owner = $("[data-sheet-owner]").value;
    const due = $("[data-sheet-due]").value;
    if (owner) item.owner = owner;
    if (due) item.due = due;
    let parentKey;
    if (isGoal) {
      p.goals.push(item);
    } else {
      const gid = $("[data-sheet-goal]").value;
      if (gid) item.goalId = gid;
      if (tag) item.tag = tag;
      p.tasks.push(item);
      parentKey = gid ? "g:" + ref + ":" + gid : "o:" + ref;
    }
    persist();
    if ($("[data-sheet-more]").checked) {
      // keep the sheet; refresh the list behind it
      text.value = ""; autoGrow(text); text.focus();
      const flash = $("[data-sheet-flash]");
      flash.textContent = "Added";
      flash.classList.remove("on"); void flash.offsetWidth; flash.classList.add("on");
      colRevealPath(ref, isGoal ? [] : [parentKey]);
      return;
    }
    sheet.close();
    colRevealPath(ref, isGoal ? ["g:" + ref + ":" + item.id] : [parentKey, "t:" + ref + ":" + item.id]);
  }
  $("[data-sheet-ok]").addEventListener("click", submit);
  text.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
  });
}

function openLinkSheet({ ref, link: editing = null }) {
  const p = ref ? containerByRef(ref) : null;
  if (ref && !p) return;
  const sheet = sheetOpen({
    kicker: p ? escapeHtml(p.name) + " › Links" : "Home › Links",
    title: editing ? "Edit link" : "Add link",
    body: `
      <input type="text" data-sheet-url placeholder="Paste a URL (e.g. docs.google.com/…)" inputmode="url" autocomplete="off" />
      <input type="text" data-sheet-name placeholder="Name (optional)" maxlength="80" />`,
    primary: editing ? "Save" : "Add link",
  });
  if (!sheet) return;
  const url = sheet.el.querySelector("[data-sheet-url]");
  const name = sheet.el.querySelector("[data-sheet-name]");
  if (editing) { url.value = editing.url || ""; name.value = editing.name || ""; }
  url.focus();
  function submit() {
    let u = url.value.trim();
    if (!u) { url.focus(); return; }
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    let host = "";
    try { host = new URL(u).hostname.replace(/^www\./, ""); } catch { url.focus(); return; }
    if (editing) {
      editing.url = u;
      editing.name = name.value.trim() || host;
      persist();
      sheet.close();
      redrawColumns(colPath[colPath.length - 1]);
      return;
    }
    const l = { id: uid(), url: u, name: name.value.trim() || host };
    p.links.push(l);
    persist();
    sheet.close();
    colRevealPath(ref, ["pl:" + ref + ":" + l.id]);
  }
  sheet.el.querySelector("[data-sheet-ok]").addEventListener("click", submit);
  [url, name].forEach((i) => i.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  }));
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
      notesList: [],
      links: [],
      docs: [],
      masterLink: "",
      masterName: "",
      pos: defaultPos(state.projects.length),
      createdAt: new Date().toISOString(),
    };
    state.projects.push(project);
    persist();
    close();
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
    showConfirm({ title: "Remove link?", message: `Remove "${link.name}" from the desktop?`, confirmLabel: "Remove" }, () => {
      state.links = state.links.filter((l) => l.id !== link.id);
      state.collections.forEach((c) => {
        c.items = c.items.filter((i) => !(i.type === "link" && i.id === link.id));
      });
      state.archived = state.archived.filter((a) => !(a.type === "link" && a.id === link.id));
      persist();
      close();
      route();
    });
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
  const p = containerByRef(pid); // project OR a company sub-project
  const item = p[kind].find((i) => i.id === itemId);
  const accent = pid.includes("~") ? kcolor(p.name) : accentFor(pid);

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
          setDone(t, !t.done);
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
    showConfirm({ title: "Remove person?", message: `Remove "${per.name}"? Their task connections will be cleared.`, confirmLabel: "Remove" }, () => {
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
    });
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
    showConfirm({ title: "Delete collection?", message: `Delete "${c.name}"? Its contents go back to the desktop.` }, () => {
      state.collections = state.collections.filter((x) => x.id !== id);
      state.archived = state.archived.filter((a) => !(a.type === "collection" && a.id === id));
      persist();
      close();
    });
  });
}

/* ---------- widget windows (Calls / Reading) ---------- */

function widgetWindowHtml(kind) {
  const w = WIDGETS[kind];
  // open items only: ticking one here keeps it (struck through) until the
  // window closes, then it leaves the widget
  const entries = taggedTasks(kind).filter((x) => !x.task.done);

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
              ${entries.map(row).join("")}
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
        if (t) { setDone(t, !t.done); toggled = t; }
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
        <span class="note-date">${noteStampHtml(n)}</span>
        <button class="action-btn item-delete" data-delnote title="Delete note">&times;</button>
      </div>
      ${threadHtml(n)}
    </div>`;
}

let projTab = "notes";
let projTabFor = null; // which project the remembered tab belongs to

/* content of the currently selected tab */
/* the one "master folder" link for a project — paste once, sits pinned at
   the top of the Docs / Links tab. Empty → a paste field; set → a big card. */
const MF_FOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const MF_EDIT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

function mfHost(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/* best-effort readable name from a URL, so the user never types it from scratch.
   Links that carry their title (Notion, GitHub, Figma, most slugged pages) give
   the real name; Google Drive/Docs links only hold an ID, so they fall back to a
   friendly by-type label the user can rename in one click. */
function nameFromUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return ""; }
  const host = u.hostname.replace(/^www\./, "");
  const segs = u.pathname.split("/").filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
  const prettify = (s) =>
    s.replace(/\.[a-z0-9]{1,5}$/i, "")   // drop a file extension
     .replace(/[-_+]+/g, " ")
     .replace(/\s+/g, " ")
     .trim()
     .replace(/\b\w/g, (c) => c.toUpperCase());
  // an opaque token: pure digits, a long low-word-density hash, or a short
  // no-separator mix of upper+lower+digits (typical random slug ID)
  const looksLikeId = (s) =>
    /^\d+$/.test(s) ||
    (/^[A-Za-z0-9_-]{15,}$/.test(s) && !/ /.test(s) && /\d/.test(s) &&
     ((s.match(/[A-Za-z]/g) || []).length < s.length * 0.55)) ||
    (/^[A-Za-z0-9]{4,24}$/.test(s) && /\d/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s));

  if (host === "docs.google.com") {
    return { document: "Google Doc", spreadsheets: "Google Sheet",
             presentation: "Google Slides", forms: "Google Form" }[segs[0]] || "Google Doc";
  }
  if (host === "drive.google.com") return segs.includes("folders") ? "Drive folder" : "Drive file";
  if (host === "sheets.google.com") return "Google Sheet";

  if (host.endsWith("notion.so") || host.endsWith("notion.site")) {
    const last = segs[segs.length - 1] || "";
    const name = prettify(last.replace(/-?[0-9a-f]{32}$/i, "")); // strip trailing page id
    return name || "Notion page";
  }
  if (host === "github.com" && segs.length >= 2) return segs[0] + "/" + segs[1];
  if (host.endsWith("figma.com") && segs.length >= 3) return prettify(segs[2]) || "Figma file";

  // generic: last readable path segment wins (skip 1-char route bits like /b/)
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    if (s && s.length >= 2 && !looksLikeId(s) && /[a-zA-Z]/.test(s)) {
      const name = prettify(s);
      if (name.length >= 2) return name;
    }
  }
  // nothing usable in the path → the service name (e.g. "Trello", "Airtable")
  const base = host.split(".").slice(-2, -1)[0] || host;
  return base.replace(/\b\w/, (c) => c.toUpperCase());
}

function masterFolderHtml(p) {
  const url = (p.masterLink || "").trim();
  if (url) {
    return `
      <div class="master-folder is-set">
        <a class="mf-iconlink" href="${escapeHtml(url)}" target="_blank" rel="noopener" title="Open">
          <span class="mf-icon mf-icon-folder">${MF_FOLDER_SVG}</span>
        </a>
        <span class="mf-body">
          <span class="mf-maintitle">Master folder</span>
          <span class="mf-sub">${escapeHtml(mfHost(url) || url)}</span>
        </span>
        <a class="mf-open" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open&nbsp;&#8599;</a>
        <button class="mf-edit" data-mf-edit title="Change the link">${MF_EDIT_SVG}</button>
      </div>`;
  }
  return `
    <div class="master-folder is-empty">
      <span class="mf-icon mf-icon-empty">${MF_FOLDER_SVG}</span>
      <input class="mf-input" data-mf-input type="text" placeholder="Paste the master link for this project…" maxlength="500" />
    </div>`;
}

/* wire the master-folder block in whatever state it's currently rendered */
function wireMasterFolder(page, p, id) {
  let wrap = page.querySelector(".master-folder");
  if (!wrap) return;

  // "" clears the link; a bare domain gets https://; anything unparseable is rejected
  const normalize = (v) => {
    let url = (v || "").trim();
    if (!url) return "";
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try { new URL(url); } catch { return null; }
    return url;
  };

  const rerender = () => {
    const fresh = elFromHtml(masterFolderHtml(p));
    wrap.replaceWith(fresh);
    wireMasterFolder(page, p, id);
  };

  const saveFrom = (input) => {
    const res = normalize(input.value);
    if (res === null) { input.focus(); return; } // invalid — stay in edit mode
    if (res === (p.masterLink || "")) { rerender(); return; } // unchanged
    p.masterLink = res;
    // the name follows the link: auto-fill it from the new URL (blank when cleared)
    p.masterName = res ? nameFromUrl(res) : "";
    persist();
    rerender();
  };

  const wireInput = (input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); saveFrom(input); }
    });
    input.addEventListener("blur", () => saveFrom(input));
    // pasting a link should commit it right away
    input.addEventListener("paste", () => setTimeout(() => saveFrom(input), 0));
  };

  const emptyInput = wrap.querySelector("[data-mf-input]");
  if (emptyInput) wireInput(emptyInput);

  const editBtn = wrap.querySelector("[data-mf-edit]");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      wrap.className = "master-folder is-empty";
      wrap.innerHTML = `
        <span class="mf-icon mf-icon-empty">${MF_FOLDER_SVG}</span>
        <input class="mf-input" data-mf-input type="text" maxlength="500" value="${escapeHtml(p.masterLink || "")}" />
        <button class="mf-clear" data-mf-clear title="Remove master link">&times;</button>`;
      const inp = wrap.querySelector("[data-mf-input]");
      wireInput(inp);
      inp.focus();
      inp.select();
      // preventDefault on mousedown keeps the input focused so its blur-save
      // doesn't fire and detach this button before the click lands
      wrap.querySelector("[data-mf-clear]").addEventListener("mousedown", (e) => {
        e.preventDefault();
        showConfirm({ title: "Remove master link?", message: "Remove the master folder link for this project?", confirmLabel: "Remove" }, () => {
          p.masterLink = "";
          p.masterName = "";
          persist();
          rerender();
        });
      });
    });
  }
}

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
  if (projTab === "work") return workHtml(p);
  if (projTab === "tracker" && p.tracker) {
    return `
      <button class="crow crow-add hub-add" data-tk-fab>+ Add to ${escapeHtml(p.tracker.name)}</button>
      <div class="hub">
        ${TRACKER_STAGES.map((s) => `
          <section class="hub-stage" data-stage-col="${s.key}" style="--kt:${s.tint}">
            <div class="kcol-head">
              <span class="kdot"></span>${s.label}
              <span class="section-count" data-kcount="${s.key}">${p.tracker.items.filter((i) => i.stage === s.key).length}</span>
            </div>
            <div class="hub-grid kcol-list">
              ${p.tracker.items.filter((i) => i.stage === s.key).map(kcardHtml).join("")}
            </div>
          </section>`).join("")}
      </div>`;
  }
  const linked = [...p.tasks, ...p.goals].filter((t) => t.link);
  const hostOf = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  };
  return `
    ${masterFolderHtml(p)}
    <div class="panel">
      <div class="section-title">Docs / Links</div>
      <div class="collection-list" style="padding-top:6px;">
        <button class="crow crow-add" data-add-plink>+ Add link</button>
        ${p.links.map((l) => `
          <a class="crow" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">
            <span class="crow-thumb crow-linkthumb"><img src="${linkIconSrc(l.url)}" alt="" onerror="this.style.display='none'" /></span>
            <span class="crow-name">${escapeHtml(l.name)}</span>
            <span class="crow-kind">${escapeHtml(hostOf(l.url))}</span>
            <button class="crow-edit" data-edit-plink="${l.id}" data-tip="Edit link">${CROW_EDIT_SVG}</button>
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

const TRACKER_STAGES = [
  { key: "watch", label: "Watchlist", tint: "#60a5fa" },
  { key: "progress", label: "In Progress", tint: "#fbbf24" },
  { key: "closed", label: "Closed", tint: "#94a3b8" },
];

/* resolve "pid" → project, or "pid~cid~…" → a sub-project nested any depth deep */
function containerByRef(ref) {
  const parts = ref.split("~");
  let node = getProject(parts[0]);
  for (let i = 1; i < parts.length && node; i++) {
    node = node.tracker && node.tracker.items.find((x) => x.id === parts[i]);
  }
  return node || null;
}

/* the ref of a sub-project's parent container ("" for a top-level project) */
function parentRefOf(ref) {
  return ref.includes("~") ? ref.split("~").slice(0, -1).join("~") : null;
}

/* tracker leads the tab bar when it exists */
function projTabsFor(p) {
  return p.tracker
    ? [{ key: "tracker", label: p.tracker.name }, ...PROJ_TABS]
    : PROJ_TABS;
}

/* stable color per company name */
function kcolor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PEOPLE_COLORS[h % PEOPLE_COLORS.length];
}

function kcardInner(i) {
  const openTasks = (i.tasks || []).filter((t) => !t.done).length;
  const noteCount = (i.notesList || []).length;
  const meta = [];
  if (openTasks) meta.push(`${openTasks} open task${openTasks > 1 ? "s" : ""}`);
  if (noteCount) meta.push(`${noteCount} note${noteCount > 1 ? "s" : ""}`);
  return `
    <div class="ktile-top">
      <span class="kmono kmono-lg" style="--kc:${kcolor(i.name)}">${escapeHtml(i.name.charAt(0).toUpperCase())}</span>
    </div>
    <div class="kcard-name">${escapeHtml(i.name)}</div>
    ${i.note ? `<div class="ktile-sum">${escapeHtml(i.note)}</div>` : ""}
    <div class="ktile-meta">${meta.join(" · ") || "Empty — click to open"}</div>`;
}

function kcardHtml(i) {
  return `<div class="kcard ktile" data-kcard="${i.id}">${kcardInner(i)}</div>`;
}

function renderProjectPage(id, tab) {
  const p = containerByRef(id);
  const isCompany = id.includes("~");
  const parentId = parentRefOf(id);
  const accent = isCompany ? kcolor(p.name) : accentFor(id);

  if (projTabFor !== id) {
    // top-level projects open on their tracker; sub-projects open on Notes
    projTab = (!isCompany && p.tracker) ? "tracker" : "notes";
    projTabFor = id;
  }
  if (tab) projTab = tab;

  const tabs = projTabsFor(p);
  const body = projTabBodyHtml(p);

  const pageHtml = `
    <div class="projectpage ${isCompany ? "companypage" : ""}" style="--pa:${accent}">
      <div class="notepage-bar">
        <button class="back-btn" data-back title="${isCompany ? "Back to " + escapeHtml(containerByRef(parentId).name) : "Back to desktop"}">&larr;</button>
        ${isCompany ? `<span class="kmono" style="--kc:${accent}">${escapeHtml(p.name.charAt(0).toUpperCase())}</span>` : ""}
        <input class="proj-name-bar" id="pj-name" value="${escapeHtml(p.name)}" maxlength="80" />
        <div class="proj-tabs">
          ${tabs.map((t) => `
            <button class="proj-tab ${projTab === t.key ? "active" : ""}" data-ptab="${t.key}">${escapeHtml(t.label)}</button>
          `).join("")}
        </div>
        <div class="titlebar-actions">
          ${isCompany ? "" : `<button class="tb-action" data-tb-archive title="Archive project">${ICONS.archive}</button>`}
          <button class="tb-action tb-action-danger" data-tb-delete title="Delete">
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
  const p = containerByRef(id);
  const isCompany = id.includes("~");
  const backHash = isCompany ? "#/p/" + parentRefOf(id) : "#/";
  const page = app.querySelector(".projectpage");

  page.querySelector("[data-back]").addEventListener("click", () => (window.location.hash = backHash));
  document.addEventListener("keydown", function esc(e) {
    if (!app.querySelector(".projectpage")) { document.removeEventListener("keydown", esc); return; }
    if (e.key === "Escape" && !e.target.closest("input, textarea, .item-editor")) {
      document.removeEventListener("keydown", esc);
      window.location.hash = backHash;
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
  const archiveBtn = page.querySelector("[data-tb-archive]");
  if (archiveBtn) archiveBtn.addEventListener("click", () => {
    state.archived.push({ type: "project", id });
    persist();
    window.location.hash = "#/";
  });
  page.querySelector("[data-tb-delete]").addEventListener("click", () => {
    showConfirm({ title: isCompany ? "Delete sub-project?" : "Delete project?", message: `Delete "${p.name}"? This cannot be undone.` }, () => {
      if (isCompany) {
        const parent = containerByRef(parentRefOf(id));
        parent.tracker.items = parent.tracker.items.filter((c) => c.id !== p.id);
        persist();
        window.location.hash = backHash;
      } else {
        state.projects = state.projects.filter((x) => x.id !== id);
        state.collections.forEach((c) => {
          c.items = c.items.filter((i) => !(i.type === "project" && i.id === id));
        });
        state.archived = state.archived.filter((a) => !(a.type === "project" && a.id === id));
        persist();
        window.location.hash = "#/";
      }
    });
  });
}

/* wiring for whatever tab is currently showing */
function wireTabContent(id, page) {
  const p = containerByRef(id);

  if (projTab === "notes") {
    const feed = page.querySelector("#notes-feed");

    function wireNoteCard(card) {
      const note = p.notesList.find((n) => n.id === card.dataset.note);
      const editor = card.querySelector(".note-card-text");

      function saveNote() {
        const next = editor.textContent.trim() ? editor.innerHTML : "";
        if (next === note.text) return; // nothing changed — don't bump the edit time
        note.text = next;
        note.updatedAt = new Date().toISOString();
        persist();
        const stamp = card.querySelector(".note-date");
        if (stamp) stamp.innerHTML = noteStampHtml(note);
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
        showConfirm({ title: "Delete note?", message: "Are you sure you want to delete this note?" }, () => {
          p.notesList = p.notesList.filter((n) => n.id !== note.id);
          persist();
          card.remove(); // in place, no flash
        });
      });
    }

    feed.querySelectorAll(":scope > .note-card[data-note]").forEach((card) => {
      wireNoteCard(card);
      wireNoteFeed(card.querySelector("[data-nfeed]"), p.notesList.find((n) => n.id === card.dataset.note));
    });

    // "+ Add a note" → a fresh card appears at the top, ready to type
    page.querySelector("[data-add-note]").addEventListener("click", () => {
      const n = { id: uid(), text: "", createdAt: new Date().toISOString() };
      p.notesList.unshift(n);
      persist();
      const card = elFromHtml(noteCardHtml(n));
      feed.prepend(card);
      wireNoteCard(card);
      wireNoteFeed(card.querySelector("[data-nfeed]"), n);
      card.querySelector(".note-card-text").focus();

    });

  } else if (projTab === "work") {
    wireWork(p, id, page);
  } else if (projTab === "tracker" && p.tracker) {
    wireTrackerTab(p, id, page);
  } else if (projTab === "links") {
    wireMasterFolder(page, p, id);
    page.querySelector("[data-add-plink]").addEventListener("click", () => showProjectLinkModal(p, id, page));
    // edit a link (rename / change URL)
    page.querySelectorAll("[data-edit-plink]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const link = p.links.find((x) => x.id === btn.dataset.editPlink);
        if (link) showProjectLinkModal(p, id, page, link);
      });
    });
    page.querySelectorAll("[data-del-plink]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const link = p.links.find((x) => x.id === btn.dataset.delPlink);
        showConfirm({ title: "Remove link?", message: `Remove "${link ? link.name : "this link"}" from this project?`, confirmLabel: "Remove" }, () => {
          p.links = p.links.filter((x) => x.id !== btn.dataset.delPlink);
          persist();
          btn.closest(".crow").remove(); // in place
        });
      });
    });
  }
}

/* ---------- tracker tab (pipeline board) ---------- */

function wireTrackerTab(p, id, page) {
  const tracker = p.tracker;

  function updateCounts() {
    TRACKER_STAGES.forEach((s) => {
      const el = page.querySelector(`[data-kcount="${s.key}"]`);
      if (el) el.textContent = tracker.items.filter((i) => i.stage === s.key).length;
    });
  }

  /* move a tile into a stage section (drag) */
  function moveCardToStage(card, item, stageKey) {
    item.stage = stageKey;
    persist();
    const list = page.querySelector(`[data-stage-col="${stageKey}"] .kcol-list`);
    list.prepend(card);
    card.classList.remove("kcard-pop");
    void card.offsetWidth;
    card.classList.add("kcard-pop");
    updateCounts();
  }

  /* tiles: drag between stages, click to ENTER the company space */
  function wireCard(card) {
    const item = tracker.items.find((x) => x.id === card.dataset.kcard);

    card.addEventListener("pointerdown", (e) => {
      if (e.target.closest("a")) return;
      e.preventDefault();
      card.setPointerCapture(e.pointerId);

      const sx = e.clientX, sy = e.clientY;
      let dragged = false;
      let ghost = null;
      let hover = null;

      function move(ev) {
        if (!dragged && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
          dragged = true;
          ghost = card.cloneNode(true);
          ghost.classList.add("kghost");
          document.body.appendChild(ghost);
          card.classList.add("kcard-src");
        }
        if (dragged) {
          ghost.style.left = ev.clientX + "px";
          ghost.style.top = ev.clientY + "px";
          const under = document.elementsFromPoint(ev.clientX, ev.clientY)
            .find((n) => n !== ghost && !ghost.contains(n));
          const col = under && under.closest("[data-stage-col]");
          if (hover && hover !== col) hover.classList.remove("kcol-over");
          hover = col;
          if (hover) hover.classList.add("kcol-over");
        }
      }

      function up() {
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerup", up);
        if (ghost) ghost.remove();
        card.classList.remove("kcard-src");
        if (hover) hover.classList.remove("kcol-over");

        if (!dragged) {
          // enter the company's own space
          window.location.hash = "#/p/" + id + "~" + item.id;
          return;
        }
        if (hover) {
          const stage = hover.dataset.stageCol;
          if (stage !== item.stage) moveCardToStage(card, item, stage);
        }
      }

      card.addEventListener("pointermove", move);
      card.addEventListener("pointerup", up);
    });
  }

  page.querySelectorAll(".kcard").forEach(wireCard);

  // floating + button: name it, it lands on top of the Watchlist, then open it
  page.querySelector("[data-tk-fab]").addEventListener("click", () => {
    const backdrop = document.createElement("div");
    backdrop.className = "window-backdrop";
    backdrop.innerHTML = `
      <div class="new-form">
        <h3>Add to ${escapeHtml(tracker.name)}</h3>
        <input type="text" id="tk-item-name" placeholder="Name (e.g. Revolut)" maxlength="80" />
        <div class="row">
          <button class="btn btn-ghost" id="tk-item-cancel">Cancel</button>
          <button class="btn btn-primary" id="tk-item-add">Add</button>
        </div>
      </div>`;
    app.appendChild(backdrop);
    const nameInput = backdrop.querySelector("#tk-item-name");
    nameInput.focus();
    const close = () => backdrop.remove();
    const add = () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const item = {
        id: uid(), name, stage: "watch",
        notesList: [], goals: [], tasks: [], links: [], docs: [],
        masterLink: "", masterName: "",
      };
      // a direct child of a top-level project is a secondary → give it its
      // permanent Tracker right away (deeper items stay leaves)
      if (!id.includes("~")) item.tracker = { name: "Tracker", items: [] };
      tracker.items.unshift(item);
      persist();
      close();
      window.location.hash = "#/p/" + id + "~" + item.id; // straight into its space
    };
    backdrop.querySelector("#tk-item-add").addEventListener("click", add);
    backdrop.querySelector("#tk-item-cancel").addEventListener("click", close);
    backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
    backdrop.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") add();
      if (e.key === "Escape") close();
    });
  });

}

/* small modal: add a link directly to the project */
/* one styled confirmation dialog for every destructive action in the app.
   showConfirm({title, message, confirmLabel, danger}, onConfirm) — the callback
   runs only if the user confirms. Replaces the native browser confirm(). */
function showConfirm(opts, onConfirm) {
  const o = typeof opts === "string" ? { message: opts } : (opts || {});
  const backdrop = document.createElement("div");
  backdrop.className = "window-backdrop";
  backdrop.innerHTML = `
    <div class="new-form confirm-dialog">
      <h3>${escapeHtml(o.title || "Are you sure?")}</h3>
      <p class="form-note">${escapeHtml(o.message || "Are you sure you want to delete this? This can't be undone.")}</p>
      <div class="row">
        <button class="btn btn-ghost" data-cf-cancel>Cancel</button>
        <button class="btn ${o.danger === false ? "btn-primary" : "btn-danger"}" data-cf-ok>${escapeHtml(o.confirmLabel || "Delete")}</button>
      </div>
    </div>`;
  app.appendChild(backdrop);
  const close = () => backdrop.remove();
  const go = () => { close(); if (typeof onConfirm === "function") onConfirm(); };
  backdrop.querySelector("[data-cf-cancel]").addEventListener("click", close);
  const okBtn = backdrop.querySelector("[data-cf-ok]");
  okBtn.addEventListener("click", go);
  okBtn.focus();
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") close();
    if (e.key === "Enter") go();
  });
}

/* pencil icon for the inline "edit link" button */
const CROW_EDIT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

/* add OR edit a project link — pass an existing link object to edit it in place */
function showProjectLinkModal(p, id, page, existing) {
  const backdrop = document.createElement("div");
  backdrop.className = "window-backdrop";
  backdrop.innerHTML = `
    <div class="new-form">
      <h3>${existing ? "Edit link" : "Add link"}</h3>
      <input type="text" id="pl-name" placeholder="Name" maxlength="60" value="${existing ? escapeHtml(existing.name || "") : ""}" />
      <input type="text" id="pl-url" placeholder="URL (e.g. figma.com/file/…)" maxlength="500" value="${existing ? escapeHtml(existing.url || "") : ""}" />
      <div class="row">
        <button class="btn btn-ghost" id="pl-cancel">Cancel</button>
        <button class="btn btn-primary" id="pl-add">${existing ? "Save" : "Add"}</button>
      </div>
    </div>
  `;
  app.appendChild(backdrop);

  const nameInput = backdrop.querySelector("#pl-name");
  const urlInput = backdrop.querySelector("#pl-url");
  nameInput.focus();

  function close() { backdrop.remove(); }

  function save() {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    if (!url) { urlInput.focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try { new URL(url); } catch { urlInput.focus(); return; }

    let host = "";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    if (existing) {
      existing.name = name || host;
      existing.url = url;
    } else {
      p.links.unshift({ id: uid(), name: name || host, url });
    }
    persist();
    close();
    // refresh just the tab content — same seamless swap as tab switching
    const inner = page.querySelector(".projectpage-inner");
    inner.innerHTML = projTabBodyHtml(p);
    wireTabContent(id, page);
  }

  backdrop.querySelector("#pl-add").addEventListener("click", save);
  backdrop.querySelector("#pl-cancel").addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") save();
    if (e.key === "Escape") close();
  });
}

/* Builds the HTML for a checkable list panel (goals or tasks) */
function itemRowHtml(item, kind = "tasks") {
  return `
      <li class="item ${item.done ? "done" : ""}" data-id="${item.id}" data-kind="${kind}">
        <button class="item-check" data-toggle title="Toggle">${CHECK_SVG}</button>
        <span class="item-main">
          <span class="item-text" data-edit title="Click to edit">
            ${item.tag ? `<span class="item-tag" style="--wt:${WIDGETS[item.tag].tint}" title="${WIDGETS[item.tag].label}">${WIDGETS[item.tag].icon}</span>` : ""}${escapeHtml(item.text)}
          </span>
          <span class="item-meta">${itemMetaHtml(item)}</span>
        </span>
        <span class="item-badges">
          ${dueChipHtml(item)}${ownerChipHtml(item)}
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

/* "1 / 3" style progress, blank when the list is empty */
function progressText(list) {
  return list.length ? `${list.filter((i) => i.done).length} / ${list.length}` : "";
}

function addRowHtml(placeholder, withTags) {
  // all four tags live on tasks; goals have none
  const tagButtons = withTags
    ? Object.keys(WIDGETS)
        .map((t) => `<button class="tag-btn" data-tag-btn="${t}" style="--wt:${WIDGETS[t].tint}" title="Tag as ${WIDGETS[t].label.toLowerCase()}">${WIDGETS[t].icon}</button>`)
        .join("")
    : "";
  return `
      <div class="add-row">
        <input type="text" data-add-input placeholder="${placeholder}" maxlength="200" />
        ${tagButtons}
        <button class="btn btn-ghost" data-add-btn>Add</button>
      </div>`;
}

/* tasks whose goal no longer exists count as loose ("Others") */
function looseTasks(p) {
  const goalIds = new Set(p.goals.map((g) => g.id));
  return p.tasks.filter((t) => !t.goalId || !goalIds.has(t.goalId));
}

/* Goals & Tasks tab: each goal is a main line with its subtasks indented
   beneath it; tasks that belong to no goal collect under "Others" */
function workHtml(p) {
  const loose = looseTasks(p);
  const goalBlock = (g) => {
    const subs = p.tasks.filter((t) => t.goalId === g.id);
    return `
      <div class="goal-block ${g.done ? "done" : ""}" data-goal-block="${g.id}">
        <ul class="item-list goal-line">${itemRowHtml(g, "goals")}</ul>
        <div class="subtasks" data-section="tasks" data-goal="${g.id}">
          <ul class="item-list">${subs.map((t) => itemRowHtml(t, "tasks")).join("")}</ul>
          ${addRowHtml("Add a subtask...", true)}
        </div>
      </div>`;
  };
  return `
    <div class="panel panel-goals" data-section="goals">
      <div class="section-title">Goals
        <span class="section-count">${progressText(p.goals)}</span>
      </div>
      <div class="goal-list">${p.goals.map(goalBlock).join("")}</div>
      ${p.goals.length ? "" : `<div class="empty-hint">No goals yet. Add one, then put its tasks underneath it.</div>`}
      ${addRowHtml("Add a goal...", false)}
    </div>
    <div class="panel panel-tasks" data-section="tasks" data-goal="">
      <div class="section-title">Others
        <span class="section-count">${progressText(loose)}</span>
      </div>
      <ul class="item-list">${loose.map((t) => itemRowHtml(t, "tasks")).join("")}</ul>
      ${loose.length ? "" : `<div class="empty-hint">Tasks that don't belong to a goal land here.</div>`}
      ${addRowHtml("Add a task...", true)}
    </div>`;
}

function wireWork(p, id, page) {
  // redraw just the tab body (goal added/removed, task moved between goals)
  const rerender = () => {
    const inner = page.querySelector(".projectpage-inner");
    inner.innerHTML = projTabBodyHtml(p);
    wireTabContent(id, page);
  };
  page.querySelectorAll("[data-section]").forEach((section) => {
    if (section.dataset.section === "goals") {
      bindItemSection("goals", p.goals, id, { section, project: p, rerender });
    } else {
      const gid = section.dataset.goal || null;
      const goalIds = new Set(p.goals.map((g) => g.id));
      bindItemSection("tasks", p.tasks, id, {
        section, project: p, rerender, goalId: gid,
        filter: gid ? (t) => t.goalId === gid : (t) => !t.goalId || !goalIds.has(t.goalId),
      });
    }
  });
}

/* Wires up add / toggle / delete inside one list. A section can hold nested
   sections (goal blocks hold their subtasks), so every lookup is limited to
   the elements that belong to THIS section. */
function bindItemSection(kind, items, projectId, opts) {
  const { section, project, rerender, goalId = null, filter = null } = opts;
  const own = (sel) => [...section.querySelectorAll(sel)].filter((el) => el.closest("[data-section]") === section);
  const input = own("[data-add-input]")[0];
  let selectedTag = null;

  // the add row's buttons must not steal focus from the input: Safari/iOS
  // don't focus buttons on click, so the input blurring would hide them
  own(".add-row button").forEach((b) => b.addEventListener("pointerdown", (e) => e.preventDefault()));

  // tag picker (tasks only): click to select, click again to unselect
  own("[data-tag-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedTag = selectedTag === btn.dataset.tagBtn ? null : btn.dataset.tagBtn;
      own("[data-tag-btn]").forEach((b) =>
        b.classList.toggle("active", b.dataset.tagBtn === selectedTag)
      );
      input.focus();
    });
  });

  const list = own(".item-list").pop();
  const visible = () => (filter ? items.filter(filter) : items);

  function updateCount() {
    const count = own(".section-count")[0];
    if (count) count.textContent = progressText(visible());
  }

  /* swap one row for a fresh render of itself — no page flash */
  function refreshRow(li, item) {
    const fresh = elFromHtml(itemRowHtml(item, kind));
    li.replaceWith(fresh);
    wireItem(fresh, item);
    updateCount();
  }

  function add() {
    const text = input.value.trim();
    if (!text) return;
    const item = {
      id: uid(), text, done: false, tag: selectedTag, createdAt: new Date().toISOString(),
      ...(goalId ? { goalId } : {}),
    };
    items.push(item);
    persist();

    // a new goal brings its own subtask list → redraw the tab, keep typing
    if (kind === "goals") {
      rerender();
      const fresh = page().querySelector('[data-section="goals"] .add-row [data-add-input]');
      if (fresh) fresh.focus();
      return;
    }

    // insert in place — no re-render, no flash
    const li = elFromHtml(itemRowHtml(item, kind));
    list.appendChild(li);
    wireItem(li, item);
    updateCount();
    const hint = own(".empty-hint")[0];
    if (hint) hint.remove();
    input.value = "";
    input.focus();
  }
  const page = () => app.querySelector(".projectpage");

  own("[data-add-btn]")[0].addEventListener("click", add);
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
        ${kind === "tasks" ? `
        <div class="editor-row editor-goal">
          ${project.goals.length ? `
          <label class="editor-field editor-field-wide">
            <span class="editor-goal-label">Under</span>
            <select id="ed-goal">
              <option value="">Others (no goal)</option>
              ${project.goals.map((g) => `<option value="${g.id}" ${item.goalId === g.id ? "selected" : ""}>${escapeHtml(g.text)}</option>`).join("")}
            </select>
          </label>` : ""}
          <label class="editor-field">
            <span class="editor-goal-label">Owner</span>
            <select id="ed-owner">
              <option value="">Me</option>
              ${[...state.people].sort((a, b) => a.name.localeCompare(b.name)).map((per) =>
                `<option value="${per.id}" ${item.owner === per.id ? "selected" : ""}>${escapeHtml(per.name)}</option>`).join("")}
            </select>
          </label>
          <label class="editor-field">
            <span class="editor-goal-label">Due</span>
            <input type="date" id="ed-due" value="${item.due || ""}" />
          </label>
        </div>` : ""}
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
      const goalSel = li.querySelector("#ed-goal");
      if (goalSel) {
        if (goalSel.value) item.goalId = goalSel.value;
        else delete item.goalId;
      }
      const ownerSel = li.querySelector("#ed-owner");
      if (ownerSel) {
        if (ownerSel.value) item.owner = ownerSel.value;
        else delete item.owner;
      }
      const dueIn = li.querySelector("#ed-due");
      if (dueIn) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dueIn.value)) item.due = dueIn.value;
        else delete item.due;
      }
      persist();
    }

    function save() {
      const before = item.goalId || "";
      applyEdits();
      if ((item.goalId || "") !== before) { rerender(); return; } // moved to another goal
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
      setDone(item, !item.done);
      persist();
      li.classList.toggle("done", item.done);
      const block = kind === "goals" && li.closest(".goal-block");
      if (block) block.classList.toggle("done", item.done);
      const metaEl = li.querySelector(".item-meta");
      if (metaEl) metaEl.innerHTML = itemMetaHtml(item);
      updateCount();
    });
    li.querySelector("[data-delete]").addEventListener("click", () => {
      const subs = kind === "goals" ? project.tasks.filter((t) => t.goalId === item.id) : [];
      const message = subs.length
        ? `Delete "${item.text}"? Its ${subs.length} subtask${subs.length > 1 ? "s" : ""} will move to Others.`
        : `Delete "${item.text}"?`;
      showConfirm({ title: kind === "goals" ? "Delete goal?" : "Delete task?", message }, () => {
        const idx = items.findIndex((i) => i.id === item.id);
        items.splice(idx, 1);
        if (kind === "goals") {
          subs.forEach((t) => delete t.goalId);
          persist();
          rerender();
          return;
        }
        persist();
        li.remove(); // in place, no flash
        updateCount();
      });
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

  own(".item").forEach((li) => {
    const item = items.find((i) => i.id === li.dataset.id);
    if (item) wireItem(li, item);
  });
}

/* ---------- Today: what needs doing now, across every space ----------
   Reads every open task in non-archived spaces (including companies inside
   trackers, at any depth) and sorts it into:
     mine:    overdue · today · next 7 days · next step under each open goal
     waiting: open tasks someone else owns, grouped by person */

let todayTab = "mine"; // "mine" | "waiting"

/* every space as { node, ref, label } — top-level projects and tracker companies */
function allSpaces() {
  const out = [];
  const visit = (node, ref, label) => {
    out.push({ node, ref, label });
    if (node.tracker) node.tracker.items.forEach((c) => {
      if (c.stage !== "closed") visit(c, ref + "~" + c.id, label + " › " + c.name);
    });
  };
  state.projects.forEach((p) => { if (!isArchived("project", p.id)) visit(p, p.id, p.name); });
  return out;
}

function todayData() {
  const spaces = allSpaces();
  const open = [];
  spaces.forEach((s) => s.node.tasks.forEach((t) => {
    if (t.done) return;
    const goal = t.goalId && s.node.goals.find((g) => g.id === t.goalId);
    open.push({ task: t, space: s, goal: goal || null });
  }));
  const byDue = (a, b) => (a.task.due || "9999").localeCompare(b.task.due || "9999");
  const mine = open.filter((x) => isMine(x.task));
  const dated = (lo, hi) => mine.filter((x) => x.task.due && dueDelta(x.task.due) >= lo && dueDelta(x.task.due) <= hi).sort(byDue);

  // next step: the first open, undated task of mine under each open goal
  const nextUp = [];
  spaces.forEach((s) => s.node.goals.forEach((g) => {
    if (g.done) return;
    const t = s.node.tasks.find((x) => !x.done && x.goalId === g.id && isMine(x) && !x.due);
    if (t) nextUp.push({ task: t, space: s, goal: g });
  }));

  const waiting = {};
  open.filter((x) => !isMine(x.task)).sort(byDue).forEach((x) => {
    (waiting[x.task.owner] = waiting[x.task.owner] || []).push(x);
  });

  return {
    overdue: dated(-100000, -1),
    today: dated(0, 0),
    soon: dated(1, 7),
    nextUp,
    waiting,
    waitingCount: open.length - mine.length,
  };
}

/* the dock badge: things of mine that are overdue or due today */
function todayUrgentCount() {
  const d = todayData();
  return d.overdue.length + d.today.length;
}

function todayRowHtml({ task, space, goal }) {
  return `
    <li class="item today-row ${task.done ? "done" : ""}" data-tref="${space.ref}" data-tid="${task.id}" style="--pa:${accentFor(space.ref.split("~")[0])}">
      <button class="item-check" data-ttoggle title="Done">${CHECK_SVG}</button>
      <span class="item-main">
        <span class="item-text">${task.tag ? `<span class="item-tag" style="--wt:${WIDGETS[task.tag].tint}">${WIDGETS[task.tag].icon}</span>` : ""}${escapeHtml(task.text)}</span>
        <span class="today-ctx">
          <button class="project-chip" data-tgoto="${space.ref}" title="Open space">${escapeHtml(space.label)}</button>
          ${goal ? `<span class="today-goal" title="Goal">${escapeHtml(goal.text)}</span>` : ""}
        </span>
      </span>
      <span class="item-badges">${dueChipHtml(task)}${ownerChipHtml(task)}</span>
    </li>`;
}

function todayGroupHtml(title, rows, cls = "") {
  if (!rows.length) return "";
  return `
    <section class="today-group ${cls}">
      <div class="today-group-head">${title}<span class="section-count">${rows.length}</span></div>
      <ul class="item-list">${rows.map(todayRowHtml).join("")}</ul>
    </section>`;
}

function todayTabsHtml(d) {
  return `
    <div class="today-tabs">
      <button class="proj-tab ${todayTab === "mine" ? "active" : ""}" data-ttab="mine">Today</button>
      <button class="proj-tab ${todayTab === "waiting" ? "active" : ""}" data-ttab="waiting">Waiting on${d.waitingCount ? ` <i class="today-tabcount">${d.waitingCount}</i>` : ""}</button>
    </div>`;
}

function todayBodyHtml(d) {
  if (todayTab === "waiting") {
    const people = Object.keys(d.waiting);
    if (!people.length) return `<div class="empty-hint today-empty">Nothing is waiting on anyone. Set an owner on a task (edit it → Owner) and it shows up here.</div>`;
    return people.map((pid) => {
      const per = personById(pid);
      return todayGroupHtml(`<span class="today-person" style="--pc:${per.color}"></span>${escapeHtml(per.name)}`, d.waiting[pid]);
    }).join("");
  }
  const html =
    todayGroupHtml("Overdue", d.overdue, "today-over") +
    todayGroupHtml("Due today", d.today, "today-due") +
    todayGroupHtml("Next 7 days", d.soon) +
    todayGroupHtml("Next step on each goal", d.nextUp);
  return html || `<div class="empty-hint today-empty">You're clear. Add a goal with subtasks, or give a task a due date, and it lands here.</div>`;
}

/* shared behaviour for the panel and the full page */
function wireToday(root, redraw) {
  root.querySelectorAll("[data-ttab]").forEach((b) =>
    b.addEventListener("click", () => { todayTab = b.dataset.ttab; redraw(); })
  );
  root.querySelectorAll("[data-ttoggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const li = btn.closest("[data-tid]");
      const node = containerByRef(li.dataset.tref);
      const t = node && node.tasks.find((x) => x.id === li.dataset.tid);
      if (!t) return;
      setDone(t, !t.done);
      persist();
      li.classList.toggle("done", t.done); // stays (struck through) until the next redraw
      const badge = app.querySelector("[data-today-badge]");
      if (badge) { const n = todayUrgentCount(); badge.textContent = n; badge.hidden = !n; }
    });
  });
  root.querySelectorAll("[data-tgoto]").forEach((b) =>
    b.addEventListener("click", () => {
      projTabFor = b.dataset.tgoto; // land on Goals & Tasks, not the default tab
      projTab = "work";
      window.location.hash = "#/p/" + b.dataset.tgoto;
    })
  );
}

function todayDateLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/* homepage panel (desktop) */
function todayPanelHtml() {
  const d = todayData();
  const collapsed = !!state.todayCollapsed;
  return `
    <aside class="today-panel ${collapsed ? "collapsed" : ""} ${state.timebarHidden ? "" : "with-timebar"}" data-today-panel>
      <div class="today-panel-head">
        <button class="today-title" data-today-collapse title="${collapsed ? "Show" : "Hide"} Today">
          ${ICONS.today}<span>Today</span>
          ${collapsed && (d.overdue.length + d.today.length) ? `<i class="today-tabcount">${d.overdue.length + d.today.length}</i>` : ""}
        </button>
        <span class="today-date">${todayDateLabel()}</span>
        <button class="today-icon-btn" data-today-full title="Open full view">${ICONS.eye}</button>
      </div>
      ${collapsed ? "" : `
        ${todayTabsHtml(d)}
        <div class="today-scroll">${todayBodyHtml(d)}</div>`}
    </aside>`;
}

function wireTodayPanel() {
  const panel = app.querySelector("[data-today-panel]");
  if (!panel) return;
  const redraw = () => {
    panel.outerHTML = todayPanelHtml();
    wireTodayPanel();
  };
  panel.querySelector("[data-today-collapse]").addEventListener("click", () => {
    state.todayCollapsed = !state.todayCollapsed;
    persist();
    redraw();
  });
  panel.querySelector("[data-today-full]").addEventListener("click", () => (window.location.hash = "#/today"));
  panel.addEventListener("pointerdown", (e) => e.stopPropagation()); // not a desktop click
  wireToday(panel, redraw);
}

/* full page: the phone's home screen, and "open full view" on desktop */
function renderTodayPage() {
  const d = todayData();
  app.innerHTML = `
    <div class="projectpage todaypage">
      <div class="notepage-bar">
        <button class="back-btn" data-back title="Desktop">&larr;</button>
        <span class="rev-title">Today</span>
        <span class="today-date">${todayDateLabel()}</span>
      </div>
      <div class="projectpage-inner today-inner">
        ${todayTabsHtml(d)}
        <div class="today-body">${todayBodyHtml(d)}</div>
      </div>
    </div>`;
  const page = app.querySelector(".todaypage");
  page.querySelector("[data-back]").addEventListener("click", () => (window.location.hash = "#/"));
  wireToday(page, renderTodayPage);
}

/* ---------- what's new: one-time feature tour, per device ---------- */

const WHATSNEW_KEY = "dailyspace-whatsnew-v1"; // bump to -v2 for the next release

const WN_SLIDES = [
  {
    title: "Timestamps on everything",
    desc: "Every task and goal now carries small stamps underneath: ＋ marks when it was created, ✓ marks when you completed it. Notes show their Created and last Edited times.",
    art: `
      <div class="wn-row">
        <span class="wn-checkdot">${CHECK_SVG}</span>
        <span class="wn-task">Review legal agreement</span>
      </div>
      <div class="wn-legend">
        <div class="wn-leg"><span class="wn-chip">＋ Jul 20, 9:41 AM</span><span class="wn-leglabel">= created</span></div>
        <div class="wn-leg"><span class="wn-chip">✓ Jul 20, 6:15 PM</span><span class="wn-leglabel">= completed</span></div>
        <div class="wn-leg"><span class="wn-chip">Created 9:41 AM · Edited 6:15 PM</span><span class="wn-leglabel">= on notes</span></div>
      </div>`,
  },
  {
    title: "Weekly Review",
    desc: "Find it behind the calendar button in the dock at the bottom of your desktop. Everything created, completed and still pending — this week, last week, this month, or any custom range. Reports are snapshots: finishing something later never rewrites an earlier week.",
    art: `
      <div class="wn-dock">
        <span class="wn-dockbtn">${ICONS.plus}</span>
        <span class="wn-docksep"></span>
        <span class="wn-dockbtn">${ICONS.shuffle}</span>
        <span class="wn-docksep"></span>
        <span class="wn-dockbtn hl">${ICONS.review}</span>
        <span class="wn-docksep"></span>
        <span class="wn-dockbtn">${ICONS.archive}</span>
      </div>
      <div class="wn-callout">&uarr;&nbsp; Review lives here</div>
      <div class="wn-tabs"><span class="on">This week</span><span>Last week</span><span>This month</span><span>Custom</span></div>`,
  },
  {
    title: "PDF export, exactly as previewed",
    desc: "Preview the report as real A4 pages — grouped by project, full notes included — then Export downloads precisely those pages. No surprises.",
    art: `
      <div class="wn-sheet">
        <span class="wn-line dark w60"></span>
        <span class="wn-line dark"></span><span class="wn-line dark"></span><span class="wn-line dark short"></span>
      </div>
      <span class="wn-export">${ICONS.download} Export</span>`,
  },
  {
    title: "Auto-lock",
    desc: "Step away for 30 minutes and this device locks itself — your password opens it again.",
    art: `
      <span class="wn-lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
      <span class="wn-locklabel">30 min idle &rarr; locked</span>`,
  },
];

let wnStep = 0;

function maybeShowWhatsNew() {
  if (localStorage.getItem(WHATSNEW_KEY)) return; // this device has seen it
  if (app.querySelector(".wn-backdrop")) return;
  wnStep = 0;
  app.appendChild(elFromHtml(`<div class="window-backdrop wn-backdrop"><div class="wn-card"></div></div>`));
  renderWnStep();
}

function renderWnStep() {
  const card = app.querySelector(".wn-card");
  if (!card) return;
  const s = WN_SLIDES[wnStep];
  const last = wnStep === WN_SLIDES.length - 1;
  card.innerHTML = `
    <button class="wn-close" data-wn-close title="Dismiss">&times;</button>
    <div class="wn-badge">What's new</div>
    <div class="wn-art">${s.art}</div>
    <h3 class="wn-title">${s.title}</h3>
    <p class="wn-desc">${s.desc}</p>
    <div class="wn-foot">
      <div class="wn-dots">${WN_SLIDES.map((_, i) => `<span class="wn-dot ${i === wnStep ? "on" : ""}"></span>`).join("")}</div>
      <div class="wn-btns">
        ${wnStep ? `<button class="btn btn-ghost btn-sm" data-wn-back>Back</button>` : ""}
        <button class="btn btn-primary btn-sm" data-wn-next>${last ? "Done" : "Next"}</button>
      </div>
    </div>`;

  const close = () => {
    localStorage.setItem(WHATSNEW_KEY, "1");
    const bd = app.querySelector(".wn-backdrop");
    if (bd) bd.remove();
  };
  card.querySelector("[data-wn-close]").addEventListener("click", close);
  const back = card.querySelector("[data-wn-back]");
  if (back) back.addEventListener("click", () => { wnStep--; renderWnStep(); });
  card.querySelector("[data-wn-next]").addEventListener("click", () => {
    if (wnStep >= WN_SLIDES.length - 1) close();
    else { wnStep++; renderWnStep(); }
  });
}

/* ---------- 5. REVIEW — period report of goals / tasks / notes ---------- */

let reviewMode = "week";                 // "week" | "month" | "custom"
let reviewFrom = null, reviewTo = null;  // "YYYY-MM-DD" for custom

function reviewRange() {
  if (reviewMode === "custom" && reviewFrom && reviewTo) {
    const start = new Date(reviewFrom + "T00:00:00");
    const end = new Date(reviewTo + "T00:00:00");
    end.setDate(end.getDate() + 1); // end date is inclusive
    if (end > start) return { start, end };
  }
  if (reviewMode === "lastweek") {
    const { start } = periodRange("week");
    const s = new Date(start);
    s.setDate(s.getDate() - 7);
    return { start: s, end: start };
  }
  return periodRange(reviewMode === "month" ? "month" : "week");
}

function rangeLabel(start, end) {
  const shown = new Date(end.getTime() - 1);
  const f = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${f(start)} – ${f(shown)}`;
}

/* everything that happened in [start, end), grouped by project */
function reviewData(start, end) {
  const inR = (iso) => {
    if (!iso) return false;
    const t = new Date(iso);
    return t >= start && t < end;
  };
  const sect = (items) => {
    // Sunday-report semantics: include everything that was ON THE PLATE during
    // the period — created in it, completed in it, or still open at its end
    // (carried over from earlier). Only items already closed before the period
    // began stay out. snapDone = status AS OF the period's end — completing
    // something later never rewrites an earlier week's report.
    const doneAsOf = (t) => !!(t.done && t.closedAt && new Date(t.closedAt) < end);
    const closedBefore = (t) => !!(t.done && t.closedAt && new Date(t.closedAt) < start);
    const rows = items
      .filter((t) => new Date(t.createdAt) < end && !closedBefore(t))
      .map((t) => ({ ...t, snapDone: doneAsOf(t) }));
    return {
      rows,
      created: rows.filter((t) => inR(t.createdAt)).length,
      completed: rows.filter((t) => t.done && inR(t.closedAt)).length,
      pending: rows.filter((t) => !t.snapDone).length,
    };
  };
  const out = [];
  state.projects.forEach((p) => {
    const goals = sect(p.goals);
    const tasks = sect(p.tasks);
    const notes = p.notesList.filter(
      (n) => inR(n.createdAt) && (n.text || "").replace(/<[^>]*>/g, "").trim()
    );
    if (goals.rows.length || tasks.rows.length || notes.length) {
      out.push({ p, goals, tasks, notes, archived: isArchived("project", p.id) });
    }
  });
  return out;
}

function noteSnippet(n) {
  const div = document.createElement("div");
  div.innerHTML = noteBodyHtml(n.text);
  const txt = div.textContent.trim().replace(/\s+/g, " ");
  return txt.length > 160 ? txt.slice(0, 160) + "…" : txt || "(empty note)";
}

function revItemRowHtml(t) {
  return `
    <li class="rev-item ${t.snapDone ? "done" : ""}">
      <span class="rev-status">${t.snapDone ? "✓" : "○"}</span>
      <span class="rev-text">${escapeHtml(t.text)}</span>
      <span class="rev-times">
        <span title="Created">＋ ${fmtDT(t.createdAt)}</span>
        ${t.snapDone ? `<span class="rev-closed" title="Completed">✓ ${fmtDT(t.closedAt)}</span>` : `<span class="rev-pending">pending</span>`}
      </span>
    </li>`;
}

function revSectionHtml(label, sec) {
  if (!sec.rows.length) return "";
  return `
    <div class="rev-section">
      <div class="rev-section-head">${label}
        <span class="rev-counts">${sec.created} created · ${sec.completed} completed · ${sec.pending} pending</span>
      </div>
      <ul class="rev-list">${sec.rows.map(revItemRowHtml).join("")}</ul>
    </div>`;
}

function renderReviewPage() {
  const { start, end } = reviewRange();
  const data = reviewData(start, end);

  const tot = { created: 0, completed: 0, pending: 0, notes: 0 };
  data.forEach((r) => {
    tot.created += r.goals.created + r.tasks.created;
    tot.completed += r.goals.completed + r.tasks.completed;
    tot.pending += r.goals.pending + r.tasks.pending;
    tot.notes += r.notes.length;
  });

  const chips = [
    { key: "week", label: "This week" },
    { key: "lastweek", label: "Last week" },
    { key: "month", label: "This month" },
    { key: "custom", label: "Custom" },
  ];

  app.innerHTML = `
    <div class="projectpage reviewpage">
      <div class="notepage-bar">
        <button class="back-btn" data-back title="Back to desktop">&larr;</button>
        <span class="rev-title">Review</span>
        <div class="proj-tabs">
          ${chips.map((c) => `<button class="proj-tab ${reviewMode === c.key ? "active" : ""}" data-rev-mode="${c.key}">${c.label}</button>`).join("")}
        </div>
        ${reviewMode === "custom" ? `
          <div class="rev-custom">
            <input type="date" id="rev-from" value="${reviewFrom || ""}" />
            <span class="rev-custom-sep">→</span>
            <input type="date" id="rev-to" value="${reviewTo || ""}" />
            <button class="btn btn-ghost btn-sm" data-rev-apply>Apply</button>
          </div>` : ""}
        <div class="titlebar-actions">
          <button class="btn btn-ghost btn-sm" data-rev-pdf>${ICONS.eye} Preview PDF</button>
        </div>
      </div>
      <div class="projectpage-inner rev-inner">
        <div class="rev-range">${rangeLabel(start, end)}</div>
        <div class="rev-summary">
          <div class="rev-stat"><span class="rev-num">${tot.created}</span><span class="rev-lab">Created</span></div>
          <div class="rev-stat rev-stat-done"><span class="rev-num">${tot.completed}</span><span class="rev-lab">Completed</span></div>
          <div class="rev-stat rev-stat-open"><span class="rev-num">${tot.pending}</span><span class="rev-lab">Pending</span></div>
          <div class="rev-stat"><span class="rev-num">${tot.notes}</span><span class="rev-lab">Note${tot.notes === 1 ? "" : "s"}</span></div>
        </div>
        ${data.length ? data.map((r) => `
          <div class="panel rev-project" style="--pa:${accentFor(r.p.id)}">
            <div class="rev-project-head">
              <span class="rev-dot"></span>${escapeHtml(r.p.name)}
              ${r.archived ? `<span class="rev-archived">archived</span>` : ""}
            </div>
            ${revSectionHtml("Goals", r.goals)}
            ${revSectionHtml("Tasks", r.tasks)}
            ${r.notes.length ? `
              <div class="rev-section">
                <div class="rev-section-head">Notes
                  <span class="rev-counts">${r.notes.length} created</span>
                </div>
                <ul class="rev-list">
                  ${r.notes.map((n) => `
                    <li class="rev-item">
                      <span class="rev-status">✎</span>
                      <span class="rev-text">${escapeHtml(noteSnippet(n))}</span>
                      <span class="rev-times">
                        <span title="Created">＋ ${fmtDT(n.createdAt)}</span>
                        ${n.updatedAt && n.updatedAt !== n.createdAt ? `<span title="Last edited">✎ ${fmtDT(n.updatedAt)}</span>` : ""}
                      </span>
                    </li>`).join("")}
                </ul>
              </div>` : ""}
          </div>`).join("")
        : `<div class="empty-hint rev-empty">Nothing was created or completed in this period.</div>`}
      </div>
    </div>
  `;

  app.querySelector("[data-back]").addEventListener("click", () => (window.location.hash = "#/"));
  app.querySelectorAll("[data-rev-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      reviewMode = btn.dataset.revMode;
      if (reviewMode === "custom" && (!reviewFrom || !reviewTo)) {
        // sensible default: the last 7 days
        const to = new Date(), from = new Date();
        from.setDate(from.getDate() - 6);
        const iso = (d) => d.toISOString().slice(0, 10);
        reviewFrom = iso(from); reviewTo = iso(to);
      }
      renderReviewPage();
    });
  });
  const applyBtn = app.querySelector("[data-rev-apply]");
  if (applyBtn) applyBtn.addEventListener("click", () => {
    const f = app.querySelector("#rev-from").value;
    const t = app.querySelector("#rev-to").value;
    if (!f || !t) return;
    reviewFrom = f; reviewTo = t;
    renderReviewPage();
  });
  app.querySelector("[data-rev-pdf]").addEventListener("click", exportReviewPdf);
}

/* print-friendly report in a new window → browser's "Save as PDF" */
function exportReviewPdf() {
  const { start, end } = reviewRange();
  const data = reviewData(start, end);
  const esc = escapeHtml;

  const itemRow = (t) => `
    <tr>
      <td class="st ${t.snapDone ? "ok" : ""}">${t.snapDone ? "✓" : "○"}</td>
      <td class="tx">${esc(t.text)}</td>
      <td class="tm">${fmtDT(t.createdAt)}</td>
      <td class="tm">${t.snapDone ? fmtDT(t.closedAt) : "—"}</td>
    </tr>`;

  const sectTable = (label, sec) => !sec.rows.length ? "" : `
    <h3>${label} <small>${sec.created} created · ${sec.completed} completed · ${sec.pending} pending</small></h3>
    <table>
      <thead><tr><th></th><th>Item</th><th>Created</th><th>Completed</th></tr></thead>
      <tbody>${sec.rows.map(itemRow).join("")}</tbody>
    </table>`;

  // full note content as flowing blocks — nothing truncated, and long notes
  // can continue across pages instead of leaving a gap
  const notesTable = (notes) => !notes.length ? "" : `
    <h3>Notes <small>${notes.length} created</small></h3>
    ${notes.map((n) => `
      <div class="note-block">
        <div class="note-head">✎ Created ${fmtDT(n.createdAt)}${n.updatedAt && n.updatedAt !== n.createdAt ? ` · Edited ${fmtDT(n.updatedAt)}` : ""}</div>
        <div class="note-body note-full">${noteBodyHtml(n.text)}</div>
      </div>`).join("")}`;

  const tot = { created: 0, completed: 0, pending: 0, notes: 0 };
  data.forEach((r) => {
    tot.created += r.goals.created + r.tasks.created;
    tot.completed += r.goals.completed + r.tasks.completed;
    tot.pending += r.goals.pending + r.tasks.pending;
    tot.notes += r.notes.length;
  });

  const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>DailySpace Review — ${rangeLabel(start, end)}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font: 13px/1.5 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a1a1a; background: #47474b; padding: 76px 0 48px; }
  /* the preview is real A4 pages (794×1123 @96dpi) — export captures them 1:1 */
  #src { position: absolute; left: -9999px; top: 0; width: 698px; }
  .page {
    width: 794px; height: 1123px;
    margin: 0 auto 24px; background: #fff;
    padding: 40px 48px;
    box-shadow: 0 10px 34px rgba(0, 0, 0, 0.45);
  }
  .page-inner { height: 100%; overflow: hidden; }
  h1 { font-size: 21px; margin-bottom: 2px; }
  .sub { color: #666; margin-bottom: 6px; }
  .totals { color: #444; font-size: 12.5px; margin-bottom: 26px; padding-bottom: 14px; border-bottom: 1px solid #ddd; }
  .project { margin-bottom: 30px; }
  tr, h2, h3 { page-break-inside: avoid; } /* only small units avoid breaks — no huge gaps */
  h2 { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 12px; }
  h2 .arch { font-size: 11px; color: #999; font-weight: normal; }
  .proj-sep { border: none; border-top: 2.5px solid #c9c9c9; margin: 30px 0 36px; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em; color: #555; margin: 14px 0 6px; }
  h3 small { text-transform: none; letter-spacing: 0; color: #999; font-weight: normal; margin-left: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #999; padding: 4px 8px; border-bottom: 1px solid #e3e3e3; }
  td { padding: 5px 8px; border-bottom: 1px solid #efefef; vertical-align: top; }
  .st { width: 22px; color: #777; }
  .tm { white-space: nowrap; color: #666; font-size: 12px; width: 150px; }
  .empty { color: #888; margin-top: 30px; }
  .note-full { line-height: 1.55; }
  .note-full ul { margin: 4px 0 4px 18px; }
  .note-block { margin: 0 0 16px; }
  .note-head { font-size: 11px; color: #999; margin-bottom: 4px; }
  .note-body { border-left: 2px solid #e3e3e3; padding-left: 12px; }
  .toolbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; gap: 14px;
    background: #1c1c1e; color: #eee;
    padding: 12px 24px;
  }
  .toolbar button {
    display: inline-flex; align-items: center; gap: 7px;
    font: 500 13px/1 inherit; color: #eee;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 9px; padding: 8px 16px; cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .toolbar button:hover { background: rgba(255, 255, 255, 0.16); border-color: rgba(255, 255, 255, 0.5); }
  .toolbar button svg { width: 14px; height: 14px; }
  .toolbar .hint { font-size: 12px; color: #aaa; }
  @media print { body { padding: 10px 4px; } .toolbar { display: none; } }
</style>
</head>
<body>
  <div class="toolbar">
    <button id="exp" onclick="exportPdf()">${ICONS.download}<span id="exp-label">Export</span></button>
    <span class="hint">Exact preview — Export downloads these pages as the PDF.</span>
  </div>
  <div id="src">
  <h1>DailySpace — Review</h1>
  <div class="sub">${rangeLabel(start, end)} &nbsp;·&nbsp; exported ${fmtDT(new Date().toISOString())}</div>
  <div class="totals">${tot.created} created · ${tot.completed} completed · ${tot.pending} pending · ${tot.notes} note${tot.notes === 1 ? "" : "s"}</div>
  ${data.length ? data.map((r) => `
    <div class="project" style="--pa:${accentFor(r.p.id)}">
      <h2>${esc(r.p.name)} ${r.archived ? '<span class="arch">(archived)</span>' : ""}</h2>
      ${sectTable("Goals", r.goals)}
      ${sectTable("Tasks", r.tasks)}
      ${notesTable(r.notes)}
    </div>`).join('<hr class="proj-sep" />')
  : '<div class="empty">Nothing was created or completed in this period.</div>'}
  </div>
  <div id="pages"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
  <script>
    /* lay the report out as real A4 pages: fill each page block by block,
       tables split between rows (heading carried over) — never mid-line */
    function paginate() {
      const src = document.getElementById("src");
      const pagesEl = document.getElementById("pages");
      let inner;
      function newPage() {
        const p = document.createElement("div");
        p.className = "page";
        inner = document.createElement("div");
        inner.className = "page-inner";
        p.appendChild(inner);
        pagesEl.appendChild(p);
      }
      const fits = function () { return inner.scrollHeight <= inner.clientHeight; };
      function place(el) {
        inner.appendChild(el);
        if (!fits() && inner.children.length > 1) { el.remove(); newPage(); inner.appendChild(el); }
      }

      /* a note body becomes a list of line-level units the pages can share */
      function lineUnits(body) {
        const units = [];
        let wrap = null;
        Array.from(body.childNodes).forEach(function (n) {
          const isBlock = n.nodeType === 1 && /^(DIV|P|UL|OL|H\d|BLOCKQUOTE|TABLE)$/.test(n.tagName);
          if (isBlock) { wrap = null; units.push(n); }
          else if (n.nodeType === 1 && n.tagName === "BR") { wrap = null; }
          else {
            if (!wrap) { wrap = document.createElement("div"); units.push(wrap); }
            wrap.appendChild(n);
          }
        });
        return units;
      }

      /* long notes flow across pages instead of jumping whole */
      function placeNote(block) {
        const head = block.querySelector(".note-head");
        const units = lineUnits(block.querySelector(".note-body"));
        let shell = document.createElement("div");
        shell.className = "note-block";
        shell.appendChild(head);
        let body = document.createElement("div");
        body.className = "note-body";
        shell.appendChild(body);
        inner.appendChild(shell);
        if (!fits() && inner.children.length > 1) { shell.remove(); newPage(); inner.appendChild(shell); }
        units.forEach(function (u) {
          body.appendChild(u);
          if (!fits()) {
            u.remove();
            newPage();
            shell = document.createElement("div");
            shell.className = "note-block";
            body = document.createElement("div");
            body.className = "note-body";
            shell.appendChild(body);
            inner.appendChild(shell);
            body.appendChild(u);
          }
        });
      }
      newPage();

      Array.from(src.children).forEach(function (block) {
        if (!block.classList.contains("project")) { place(block); return; }

        Array.from(block.children).forEach(function (kid) {
          if (kid.classList && kid.classList.contains("note-block")) { placeNote(kid); return; }
          if (kid.tagName !== "TABLE") { place(kid); return; }

          const thead = kid.querySelector("thead");
          const rows = Array.from(kid.querySelectorAll("tbody tr"));
          let table;
          const openTable = function () {
            table = document.createElement("table");
            if (thead) table.appendChild(thead.cloneNode(true));
            table.appendChild(document.createElement("tbody"));
            inner.appendChild(table);
          };
          openTable();
          rows.forEach(function (tr) {
            table.tBodies[0].appendChild(tr);
            if (!fits()) {
              tr.remove();
              const emptyTable = !table.tBodies[0].children.length;
              if (emptyTable) table.remove();
              // carry a heading sitting right above so it isn't orphaned
              const movers = [];
              if (emptyTable) {
                let last = inner.lastElementChild;
                while (last && /^H[23]$/.test(last.tagName)) { movers.unshift(last); last = last.previousElementSibling; }
              }
              newPage();
              movers.forEach(function (m) { inner.appendChild(m); });
              openTable();
              table.tBodies[0].appendChild(tr);
            }
          });
        });
      });
      src.remove();
    }
    window.addEventListener("DOMContentLoaded", paginate);

    /* export = one capture per preview page, 1:1 */
    async function exportPdf() {
      const btn = document.getElementById("exp");
      const label = document.getElementById("exp-label");
      if (!window.html2canvas || !window.jspdf) { window.print(); return; } // offline fallback
      btn.disabled = true; label.textContent = "Exporting…";
      try {
        const pageW = 794, pageH = 1123; // A4 @96dpi
        const pdf = new jspdf.jsPDF({ unit: "px", format: [pageW, pageH], hotfixes: ["px_scaling"] });
        const pages = document.querySelectorAll(".page");
        for (let i = 0; i < pages.length; i++) {
          const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true });
          if (i > 0) pdf.addPage([pageW, pageH]);
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageW, pageH);
        }
        pdf.save(${JSON.stringify(`DailySpace Review ${rangeLabel(start, end)}.pdf`)});
      } catch (e) {
        window.print();
      }
      btn.disabled = false;
      label.textContent = "Export";
    }
  <\/script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Allow pop-ups for this site to export the PDF."); return; }
  w.document.write(doc);
  w.document.close();
}
