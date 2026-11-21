// Local preview: serves the app and runs /api/plan the way Vercel would.
//   npm run dev        → http://localhost:5173
// Put ANTHROPIC_API_KEY=... in .env.local (git-ignored) to get real AI drafts;
// without it the Calendar shows a labelled sample draft.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
process.env.PLAN_SKIP_AUTH = "1"; // local only: no sign-in check on the planner

const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const port = Number(process.env.PORT || 5173);

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/plan") {
    const { default: handler } = await import(path.join(root, "api/plan.js") + "?t=" + Date.now());
    return handler(req, res);
  }
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root) || file.includes(`${path.sep}node_modules${path.sep}`) || file.endsWith(".env.local")) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end("Not found"); }
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`DailySpace on http://localhost:${port}  (AI drafts: ${process.env.ANTHROPIC_API_KEY ? "on" : "off - sample drafts"})`);
});
