// POST /api/plan — drafts Nikhel's day as calendar blocks.
// Runs as a Vercel function, so the Anthropic key never reaches the browser.
// The app sends: the date, the planning rules, what was typed (optional),
// pending tasks, and (for "change this") the current plan + the change asked for.
// It gets back blocks it can draw straight onto the day view.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

// public values (they're in app.js too); only used to check who is asking
const SUPABASE_URL = process.env.SUPABASE_URL || "https://xktzviuelnrfqpazdtvl.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_2kD95uDSNPp0eF1ocE9gQQ_S9wVwdZA";

const KINDS = ["meeting", "prep", "followup", "focus", "task", "lunch", "break"];

const Plan = z.object({
  summary: z.string(),
  blocks: z.array(z.object({
    start: z.string(),          // "HH:MM", 24-hour, local
    end: z.string(),
    title: z.string(),
    kind: z.enum(KINDS),
    group: z.string().nullable(),   // ties a meeting to its prep and follow-up
    task_id: z.string().nullable(), // a pending task this block works on
    reason: z.string(),
  })),
  unscheduled: z.array(z.object({
    task_id: z.string().nullable(),
    title: z.string(),
    why: z.string(),
  })),
  questions: z.array(z.string()),
});

const INSTRUCTIONS = `You plan one working day for Nikhel, a company director, inside an app called DailySpace. Produce a realistic, time-blocked schedule that could be put straight onto a calendar.

Follow the planning rules exactly. Nikhel's team writes them, and they override your own defaults.

- Times are 24-hour HH:MM local time on the given date. Blocks must not overlap. Keep inside working hours unless what Nikhel said asks otherwise.
- If the date is today, start no earlier than the current time, rounded up to the next quarter hour.
- Every meeting Nikhel mentions gets a prep block, the meeting itself and a follow-up block, sized by the rules. Give all three the same group name; other blocks have group null.
- kind is one of: meeting, prep, followup, focus, task, lunch, break.
- Fit pending tasks by urgency: overdue first, then due today, then due soon. When a block works on a task, set task_id to that task's id exactly as given; otherwise null. Never invent ids.
- Don't cram. What doesn't fit goes in unscheduled with a short reason.
- Ask a question only when a missing fact would change the plan (for example a meeting with no length). Otherwise make a sensible assumption and note it in that block's reason.
- When a current plan and a requested change are given, change only what is asked and keep everything else as it is.
- summary: one or two plain sentences on the shape of the day. reason: under 12 words.`;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

// only the signed-in DailySpace owner may spend the key
async function signedInEmail(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.email ? u.email : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, { error: "no_key" });

  if (process.env.PLAN_SKIP_AUTH !== "1") {
    const email = await signedInEmail(req);
    if (!email) return send(res, 401, { error: "signin" });
    const allowed = process.env.PLAN_ALLOWED_EMAIL;
    if (allowed && email.toLowerCase() !== allowed.toLowerCase()) return send(res, 403, { error: "forbidden" });
  }

  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "body" }); }
  const { date, weekday, isToday, now, timezone, rules, input, instruction, current, tasks } = body || {};
  if (!date || !rules) return send(res, 400, { error: "missing" });

  const user = [
    `Date: ${weekday || ""} ${date}${isToday ? ` (today). Current time: ${now}` : ""}. Timezone: ${timezone || "local"}.`,
    `What Nikhel said about the day:\n${(input || "").trim() || "(nothing typed: draft the day from the pending tasks and the rules)"}`,
    `Pending tasks (JSON):\n${JSON.stringify(tasks || [])}`,
    current && current.length ? `Current plan (JSON):\n${JSON.stringify(current)}` : "",
    instruction ? `Requested change: ${instruction}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(Plan) },
      system: `${INSTRUCTIONS}\n\n<planning_rules>\n${rules}\n</planning_rules>`,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") return send(res, 422, { error: "refused" });
    if (response.stop_reason === "max_tokens" || !response.parsed_output) return send(res, 502, { error: "incomplete" });
    return send(res, 200, response.parsed_output);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return send(res, 503, { error: "bad_key" });
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: "busy" });
    if (err instanceof Anthropic.APIError) return send(res, 502, { error: "api", status: err.status });
    return send(res, 500, { error: "server" });
  }
}
