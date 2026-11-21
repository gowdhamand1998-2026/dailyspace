/* ============================================================
   Calendar: Nikhel's day, drafted by AI from what's typed, the
   pending tasks and the planning rules, then edited and accepted.
   Loaded before app.js; it only defines functions, which use
   app.js's state, helpers and icons when they run.
   ============================================================ */

const CAL_DEFAULT_RULES = `Whose day: Nikhel (director)

Working hours: 09:30 – 18:30
Lunch: 13:00 – 14:00, always blocked

Meetings
- Every meeting gets prep, the meeting itself, and a follow-up.
- Team meetings: 15 min prep, 10 min follow-up.
- Solo or external meetings: 10 min prep, 10 min follow-up.
- Calls with Stellar members: a 15-minute prep, for Stellar members only.

Focus
- Protect at least one 90-minute focus block, ideally in the morning.
- Leave 10 minutes between back-to-back blocks where possible.

Tasks
- Overdue first, then due today, then due this week.
- Don't overfill the day: list what doesn't fit instead.`;

const CAL_KINDS = {
  meeting: "Meeting", prep: "Prep", followup: "Follow-up", focus: "Focus",
  task: "Task", lunch: "Lunch", break: "Break",
};
const CAL_START = 7 * 60;   // the grid runs 07:00 – 21:00
const CAL_END = 21 * 60;
const CAL_PX = 1.1;         // pixels per minute
const CAL_SNAP = 15;

let calDay = null;          // "YYYY-MM-DD" on screen
let calBusy = false;
let calError = "";
let calSel = null;          // { id } of the block being edited
let calRulesOpen = false;

function calStore() {
  if (!state.calendar) state.calendar = { rules: CAL_DEFAULT_RULES, days: {} };
  if (!state.calendar.days) state.calendar.days = {};
  if (typeof state.calendar.rules !== "string") state.calendar.rules = CAL_DEFAULT_RULES;
  return state.calendar;
}
function calDayData(k) {
  const c = calStore();
  if (!c.days[k]) c.days[k] = { blocks: [], draft: null };
  return c.days[k];
}
const calMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim()); return m ? +m[1] * 60 + +m[2] : NaN; };
const calHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const calLabel = (min) => { const h = Math.floor(min / 60), m = min % 60; const h12 = ((h + 11) % 12) + 1; return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`; };

/* the pending tasks the planner can use: open, most urgent first */
function calTasks() {
  return allTaskRefs()
    .filter(({ task }) => !task.done)
    .sort((a, b) => (a.task.due || "9999").localeCompare(b.task.due || "9999"))
    .slice(0, 40)
    .map(({ task, ref, space }) => ({
      id: task.id, ref, title: task.text, space: space.label,
      due: task.due || null, overdue: !!(task.due && dueDelta(task.due) < 0),
    }));
}

/* make whatever came back safe to draw: valid times, inside the grid, no overlaps, real task ids */
function calClean(plan, tasks) {
  const known = new Map(tasks.map((t) => [t.id, t]));
  const blocks = (plan.blocks || [])
    .map((b) => ({ ...b, s: calMin(b.start), e: calMin(b.end) }))
    .filter((b) => Number.isFinite(b.s) && Number.isFinite(b.e) && b.e > b.s)
    .map((b) => ({ ...b, s: Math.max(CAL_START, b.s), e: Math.min(CAL_END, b.e) }))
    .filter((b) => b.e > b.s)
    .sort((a, b) => a.s - b.s);
  let last = -1;
  const out = [];
  blocks.forEach((b) => {
    if (b.s < last) b.s = last;               // nudge overlaps down rather than stack them
    if (b.e - b.s < 5) return;
    last = b.e;
    const t = b.task_id && known.get(b.task_id);
    out.push({
      id: uid(), start: calHHMM(b.s), end: calHHMM(b.e),
      title: String(b.title || "").slice(0, 120) || CAL_KINDS[b.kind] || "Block",
      kind: CAL_KINDS[b.kind] ? b.kind : "task",
      group: b.group || null,
      task: t ? { id: t.id, ref: t.ref } : null,
      reason: String(b.reason || "").slice(0, 160),
    });
  });
  return {
    blocks: out,
    summary: String(plan.summary || ""),
    questions: (plan.questions || []).map(String).slice(0, 5),
    unscheduled: (plan.unscheduled || []).map((u) => ({ title: String(u.title || ""), why: String(u.why || "") })).slice(0, 12),
  };
}

/* until the AI key is added: a plain layout from the rules and tasks, clearly labelled */
function calSamplePlan(k, tasks) {
  const rules = calStore().rules;
  const hours = /working hours[^0-9]*(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/i.exec(rules);
  const lunch = /lunch[^0-9]*(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/i.exec(rules);
  const dayS = hours ? calMin(hours[1]) : 570, dayE = hours ? calMin(hours[2]) : 1110;
  const lS = lunch ? calMin(lunch[1]) : 780, lE = lunch ? calMin(lunch[2]) : 840;
  const nowD = new Date();
  let t = dayS;
  if (k === dateKey(nowD)) t = Math.max(t, Math.ceil((nowD.getHours() * 60 + nowD.getMinutes()) / 15) * 15);
  const blocks = [{ start: calHHMM(lS), end: calHHMM(lE), title: "Lunch", kind: "lunch", group: null, task_id: null, reason: "Blocked by the planning rules" }];
  const place = (len, b) => {
    if (t < lE && t + len > lS) t = lE;
    if (t + len > dayE) return false;
    blocks.push({ ...b, start: calHHMM(t), end: calHHMM(t + len) });
    t += len + 10;
    return true;
  };
  const queue = tasks.slice();
  const first = queue.shift();
  if (first) place(90, { title: first.title, kind: "focus", group: null, task_id: first.id, reason: first.overdue ? "Overdue, so it gets the focus block" : "Most urgent task" });
  const left = [];
  queue.forEach((x) => { if (!place(x.overdue ? 45 : 30, { title: x.title, kind: "task", group: null, task_id: x.id, reason: x.due ? `Due ${dueLabel(x.due).toLowerCase()}` : "Pending" })) left.push(x); });
  return {
    summary: "Sample layout. The AI isn't connected yet, so this only spreads pending tasks around lunch; it can't read what you type.",
    blocks, questions: [],
    unscheduled: left.map((x) => ({ task_id: x.id, title: x.title, why: "No room left today" })),
  };
}

async function calGenerate({ instruction } = {}) {
  if (calBusy) return;
  const k = calDay;
  const day = calDayData(k);
  const input = (app.querySelector("[data-cal-input]") || {}).value || "";
  const tasks = calTasks();
  const now = new Date();
  const payload = {
    date: k,
    weekday: keyToDate(k).toLocaleDateString("en-GB", { weekday: "long" }),
    isToday: k === dateKey(now),
    now: calHHMM(now.getHours() * 60 + now.getMinutes()),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    rules: calStore().rules,
    input: instruction ? (day.draft && day.draft.input) || "" : input,
    instruction: instruction || "",
    current: instruction ? ((day.draft || day).blocks || []).map((b) => ({ start: b.start, end: b.end, title: b.title, kind: b.kind, group: b.group, task_id: b.task ? b.task.id : null })) : [],
    tasks: tasks.map(({ ref, ...t }) => t),
  };
  calBusy = true; calError = ""; calSel = null;
  renderCalendarPage();
  let plan = null, source = "ai";
  try {
    const headers = { "Content-Type": "application/json" };
    if (db) {
      const { data } = await db.auth.getSession();
      if (data && data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    const r = await fetch("/api/plan", { method: "POST", headers, body: JSON.stringify(payload) });
    if (r.ok) plan = await r.json();
    else {
      const err = await r.json().catch(() => ({}));
      if (r.status === 503 || r.status === 404 || r.status === 405 || r.status === 501) source = "sample";
      else calError = err.error === "signin" ? "Sign in again to use the planner."
        : err.error === "busy" ? "The planner is busy. Try again in a minute."
        : err.error === "refused" ? "The planner couldn't draft this one. Try rewording it."
        : "Couldn't draft the day. Try again.";
    }
  } catch { source = "sample"; }
  if (!plan && source === "sample") plan = calSamplePlan(k, tasks);
  if (plan) {
    day.draft = { ...calClean(plan, tasks), source, input: payload.input, at: new Date().toISOString() };
    persist();
  }
  calBusy = false;
  renderCalendarPage();
}

/* lay overlapping blocks side by side (accepted blocks and a draft can overlap) */
function calLanes(list) {
  const items = list.map((b) => ({ b, s: calMin(b.start), e: calMin(b.end), lane: 0, lanes: 1 })).sort((x, y) => x.s - y.s || y.e - x.e);
  let cluster = [], clusterEnd = -1;
  const flush = () => { const n = Math.max(1, ...cluster.map((c) => c.lane + 1)); cluster.forEach((c) => { c.lanes = n; }); cluster = []; };
  items.forEach((it) => {
    if (it.s >= clusterEnd && cluster.length) { flush(); clusterEnd = -1; }
    const used = new Set(cluster.filter((c) => c.e > it.s).map((c) => c.lane));
    while (used.has(it.lane)) it.lane++;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  });
  if (cluster.length) flush();
  return items;
}

function calBlockHtml({ b, s, e, lane, lanes }, draft) {
  const top = (s - CAL_START) * CAL_PX, h = Math.max(18, (e - s) * CAL_PX - 2);
  const t = b.task && allTaskRefs().find((x) => x.task.id === b.task.id);
  const short = e - s < 40;
  return `<div class="cal-block k-${b.kind} ${draft ? "is-draft" : ""} ${calSel === b.id ? "is-sel" : ""} ${short ? "is-short" : ""}"
      data-cal-block="${b.id}" data-cal-draft="${draft ? 1 : 0}"
      style="top:${top}px;height:${h}px;left:calc(${(lane / lanes) * 100}% + 2px);width:calc(${100 / lanes}% - 6px)"
      title="${escapeHtml(`${b.title} · ${calLabel(s)}–${calLabel(e)}${b.reason ? "\n" + b.reason : ""}`)}">
      <div class="cal-block-title">${escapeHtml(b.title)}</div>
      <div class="cal-block-meta">${calLabel(s)} – ${calLabel(e)}${!short && t ? ` · ${escapeHtml(t.space.label)}` : ""}${!short ? ` · ${CAL_KINDS[b.kind] || ""}` : ""}</div>
      <span class="cal-resize" data-cal-resize></span>
    </div>`;
}

function calSideHtml(day) {
  const d = day.draft;
  const tasksN = calTasks().length;
  if (calRulesOpen) {
    return `
      <div class="cal-side-head"><h3>Planning rules</h3><button class="col-act col-act-quiet" data-cal-rules-close>Done</button></div>
      <p class="cal-hint">Plain English. Every draft follows these, so change them whenever the way Nikhel works changes.</p>
      <textarea class="cal-rules" data-cal-rules-text spellcheck="true">${escapeHtml(calStore().rules)}</textarea>
      <div class="col-acts"><button class="col-act col-act-quiet" data-cal-rules-reset>Reset to the starting rules</button></div>`;
  }
  const sel = calSel && [...(d ? d.blocks : []), ...day.blocks].find((b) => b.id === calSel);
  const selHtml = sel ? `
      <div class="cal-edit">
        <div class="cal-side-head"><h3>Block</h3><button class="col-act col-act-quiet" data-cal-unsel>Close</button></div>
        <input class="cal-edit-title" data-cal-edit="title" value="${escapeHtml(sel.title)}" />
        <div class="cal-edit-row">
          <input type="time" step="900" data-cal-edit="start" value="${sel.start}" />
          <span>to</span>
          <input type="time" step="900" data-cal-edit="end" value="${sel.end}" />
          <select data-cal-edit="kind">${Object.entries(CAL_KINDS).map(([k, l]) => `<option value="${k}" ${sel.kind === k ? "selected" : ""}>${l}</option>`).join("")}</select>
        </div>
        ${sel.reason ? `<p class="cal-reason">${escapeHtml(sel.reason)}</p>` : ""}
        <div class="col-acts"><button class="col-act col-act-quiet" data-cal-del>Remove block</button></div>
      </div>` : "";

  if (calBusy) return `${selHtml}<div class="cal-busy"><span class="cal-spin"></span>Drafting Nikhel's day…</div>`;

  if (!d) {
    return `${selHtml}
      <div class="cal-side-head"><h3>${day.blocks.length ? "Plan again" : "Plan Nikhel's day"}</h3></div>
      <textarea class="cal-input" data-cal-input rows="5" placeholder="Optional. Anything about the day: meetings, when Nikhel is free, what has to happen.\n\nLeave it empty and the draft comes from pending tasks and the planning rules."></textarea>
      <button class="btn btn-primary cal-go" data-cal-generate>Generate draft</button>
      <p class="cal-hint">Uses ${tasksN} pending task${tasksN === 1 ? "" : "s"} and your planning rules.</p>
      ${calError ? `<p class="cal-error">${escapeHtml(calError)}</p>` : ""}`;
  }
  return `${selHtml}
    <div class="cal-side-head"><h3>Draft</h3><span class="cal-draft-tag">${d.blocks.length} block${d.blocks.length === 1 ? "" : "s"}</span></div>
    ${d.source === "sample" ? `<p class="cal-sample">Sample only. Add the AI key and "Generate draft" will read what you type and plan meetings with prep and follow-up.</p>` : ""}
    ${d.summary ? `<p class="cal-summary">${escapeHtml(d.summary)}</p>` : ""}
    ${d.questions.length ? `<div class="cal-list"><div class="cal-list-h">Questions</div>${d.questions.map((q) => `<p>${escapeHtml(q)}</p>`).join("")}</div>` : ""}
    ${d.unscheduled.length ? `<div class="cal-list"><div class="cal-list-h">Didn't fit · ${d.unscheduled.length}</div>${d.unscheduled.slice(0, 5).map((u) => `<p><b>${escapeHtml(u.title)}</b>${u.why ? ` · ${escapeHtml(u.why)}` : ""}</p>`).join("")}${d.unscheduled.length > 5 ? `<p class="cal-more">and ${d.unscheduled.length - 5} more</p>` : ""}</div>` : ""}
    <div class="cal-actions">
      <button class="btn btn-primary" data-cal-accept>Accept plan</button>
      <button class="col-act col-act-quiet" data-cal-discard>Discard</button>
    </div>
    <div class="cal-change">
      <textarea class="cal-input" data-cal-change rows="2" placeholder="Ask for a change, e.g. move the focus block after lunch"></textarea>
      <button class="col-act" data-cal-update>Update draft</button>
    </div>
    ${calError ? `<p class="cal-error">${escapeHtml(calError)}</p>` : ""}`;
}

function renderCalendarPage() {
  calStore();
  if (!calDay) calDay = dateKey(new Date());
  const day = calDayData(calDay);
  const date = keyToDate(calDay);
  const isToday = calDay === dateKey(new Date());
  const accepted = day.blocks.map((b) => ({ ...b, _d: false }));
  const draft = day.draft ? day.draft.blocks.map((b) => ({ ...b, _d: true })) : [];
  // with a draft on screen, show it in front; accepted blocks stay faint behind it
  const lanes = calLanes(day.draft ? draft : accepted);
  const ghosts = day.draft ? accepted : [];

  const hours = [];
  for (let m = CAL_START; m <= CAL_END; m += 60) hours.push(m);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const prevScroll = app.querySelector("[data-cal-scroll]")?.scrollTop;

  app.innerHTML = `
    <div class="calpage">
      <div class="cal-bar">
        <button class="cal-back" data-cal-back aria-label="Back to Home"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg><span>Home</span></button>
        <div class="cal-nav">
          <button class="cal-nav-btn" data-cal-step="-1" aria-label="Previous day">‹</button>
          <button class="col-act" data-cal-today ${isToday ? "disabled" : ""}>Today</button>
          <button class="cal-nav-btn" data-cal-step="1" aria-label="Next day">›</button>
        </div>
        <div class="cal-date"><b>${escapeHtml(date.toLocaleDateString("en-GB", { weekday: "long" }))}</b> ${escapeHtml(date.toLocaleDateString("en-GB", { day: "numeric", month: "long" }))}</div>
        <span class="cal-who">Nikhel's day</span>
        <button class="col-act cal-rules-btn ${calRulesOpen ? "is-on" : ""}" data-cal-rules>Planning rules</button>
      </div>
      <div class="cal-body">
        <div class="cal-scroll" data-cal-scroll>
          <div class="cal-grid" style="height:${(CAL_END - CAL_START) * CAL_PX}px">
            ${hours.map((m) => `<div class="cal-hour" style="top:${(m - CAL_START) * CAL_PX}px"><span>${calLabel(m)}</span></div>`).join("")}
            <div class="cal-lane" data-cal-lane>
              ${ghosts.map((b) => `<div class="cal-ghost" style="top:${(calMin(b.start) - CAL_START) * CAL_PX}px;height:${Math.max(14, (calMin(b.end) - calMin(b.start)) * CAL_PX - 2)}px"></div>`).join("")}
              ${lanes.map((it) => calBlockHtml(it, it.b._d)).join("")}
              ${isToday && nowMin > CAL_START && nowMin < CAL_END ? `<div class="cal-now" style="top:${(nowMin - CAL_START) * CAL_PX}px"></div>` : ""}
              ${!lanes.length && !calBusy ? `<div class="cal-empty">Nothing planned yet. Generate a draft on the right.</div>` : ""}
            </div>
          </div>
        </div>
        <aside class="cal-side">${calSideHtml(day)}</aside>
      </div>
    </div>`;

  const sc = app.querySelector("[data-cal-scroll]");
  if (sc) sc.scrollTop = prevScroll != null ? prevScroll : Math.max(0, ((isToday ? Math.min(nowMin, 17 * 60) : 9 * 60) - 60 - CAL_START) * CAL_PX);
  wireCalendar(day);
}

function wireCalendar(day) {
  const $ = (s) => app.querySelector(s);
  $("[data-cal-back]")?.addEventListener("click", () => { window.location.hash = "#/"; });
  app.querySelectorAll("[data-cal-step]").forEach((b) => b.addEventListener("click", () => {
    const d = keyToDate(calDay); d.setDate(d.getDate() + Number(b.dataset.calStep));
    calDay = dateKey(d); calSel = null; calError = ""; renderCalendarPage();
  }));
  $("[data-cal-today]")?.addEventListener("click", () => { calDay = dateKey(new Date()); calSel = null; renderCalendarPage(); });
  $("[data-cal-rules]")?.addEventListener("click", () => { calRulesOpen = !calRulesOpen; renderCalendarPage(); });
  $("[data-cal-rules-close]")?.addEventListener("click", () => { calRulesOpen = false; renderCalendarPage(); });
  const rulesBox = $("[data-cal-rules-text]");
  rulesBox?.addEventListener("input", () => { calStore().rules = rulesBox.value; persist(); });
  $("[data-cal-rules-reset]")?.addEventListener("click", () => showConfirm({ title: "Reset planning rules?", message: "Your edits to the rules will be replaced by the starting rules.", confirmLabel: "Reset" }, () => { calStore().rules = CAL_DEFAULT_RULES; persist(); renderCalendarPage(); }));

  $("[data-cal-generate]")?.addEventListener("click", () => calGenerate());
  $("[data-cal-input]")?.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) calGenerate(); });
  const change = $("[data-cal-change]");
  const update = () => { const v = change.value.trim(); if (v) calGenerate({ instruction: v }); else change.focus(); };
  $("[data-cal-update]")?.addEventListener("click", update);
  change?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); update(); } });
  $("[data-cal-accept]")?.addEventListener("click", () => { day.blocks = day.draft.blocks; day.draft = null; calSel = null; persist(); renderCalendarPage(); });
  $("[data-cal-discard]")?.addEventListener("click", () => { day.draft = null; calSel = null; persist(); renderCalendarPage(); });

  // editing the selected block
  const list = () => (day.draft ? day.draft.blocks : day.blocks);
  const selBlock = () => [...(day.draft ? day.draft.blocks : []), ...day.blocks].find((b) => b.id === calSel);
  $("[data-cal-unsel]")?.addEventListener("click", () => { calSel = null; renderCalendarPage(); });
  app.querySelectorAll("[data-cal-edit]").forEach((el) => el.addEventListener("change", () => {
    const b = selBlock(); if (!b) return;
    const f = el.dataset.calEdit;
    if (f === "start" || f === "end") {
      const v = calMin(el.value); if (!Number.isFinite(v)) return;
      const s = f === "start" ? v : calMin(b.start), e = f === "end" ? v : calMin(b.end);
      if (e <= s) return renderCalendarPage();
      b.start = calHHMM(s); b.end = calHHMM(e);
    } else b[f] = el.value.trim() || b[f];
    persist(); renderCalendarPage();
  }));
  $("[data-cal-del]")?.addEventListener("click", () => {
    const arr = list(); const i = arr.findIndex((b) => b.id === calSel);
    if (i >= 0) arr.splice(i, 1);
    calSel = null; persist(); renderCalendarPage();
  });

  // drag a block to move it, drag its bottom edge to resize; a click selects it
  app.querySelectorAll("[data-cal-block]").forEach((el) => {
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const b = list().find((x) => x.id === el.dataset.calBlock);
      if (!b) return;
      const resize = !!e.target.closest("[data-cal-resize]");
      const s0 = calMin(b.start), e0 = calMin(b.end), y0 = e.clientY;
      let moved = false;
      el.setPointerCapture(e.pointerId);
      const onMove = (ev) => {
        const dm = Math.round((ev.clientY - y0) / CAL_PX / CAL_SNAP) * CAL_SNAP;
        if (!moved && Math.abs(ev.clientY - y0) < 4) return;
        moved = true;
        let s = s0, en = e0;
        if (resize) en = Math.max(s0 + CAL_SNAP, Math.min(CAL_END, e0 + dm));
        else { s = Math.max(CAL_START, Math.min(CAL_END - (e0 - s0), s0 + dm)); en = s + (e0 - s0); }
        b.start = calHHMM(s); b.end = calHHMM(en);
        el.style.top = (s - CAL_START) * CAL_PX + "px";
        el.style.height = Math.max(18, (en - s) * CAL_PX - 2) + "px";
        el.querySelector(".cal-block-meta").textContent = `${calLabel(s)} – ${calLabel(en)}`;
        el.classList.add("is-dragging");
      };
      const onUp = () => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        if (moved) persist();
        else calSel = calSel === b.id ? null : b.id;
        renderCalendarPage();
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    });
  });
}
