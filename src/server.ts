const PORT = Number(process.env.FLUX_PORT) || 4000;
import { serve } from "bun";
import { Database } from "bun:sqlite";
import { homedir } from "os";
import { dirname, join } from "path";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync } from "fs";

// Secrets live in a SQLite DB under the user's home dir (never in the repo).
// Override with FLUX_DB=/path/to/flux.db (used by tests).
const DB_PATH = process.env.FLUX_DB || join(homedir(), ".flux", "flux.db");

mkdirSync(dirname(DB_PATH), { recursive: true, mode: 0o700 });
const db = new Database(DB_PATH, { create: true });
try { chmodSync(DB_PATH, 0o600); } catch {}
db.run("CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, provider TEXT NOT NULL, label TEXT NOT NULL, api_key TEXT NOT NULL, created_at TEXT NOT NULL)");

// One-time migration from legacy ./subscriptions.json, then archive it.
try {
  if (existsSync("./subscriptions.json")) {
    const count = (db.query("SELECT COUNT(*) AS n FROM subscriptions").get() as { n: number }).n;
    if (count === 0) {
      const legacy = JSON.parse(readFileSync("./subscriptions.json", "utf8"));
      const ins = db.prepare("INSERT OR IGNORE INTO subscriptions (id, provider, label, api_key, created_at) VALUES (?,?,?,?,?)");
      for (const s of legacy) ins.run(s.id, s.provider, s.label || s.provider, s.apiKey, s.createdAt || new Date().toISOString());
    }
    renameSync("./subscriptions.json", "./subscriptions.json.migrated");
  }
} catch {}

interface SubRow { id: string; provider: string; label: string; api_key: string; created_at: string; }

function toPublic(row: { id: string; provider: string; label: string; created_at: string }) {
  return { id: row.id, provider: row.provider, label: row.label, createdAt: row.created_at };
}

// Public list: keys are NEVER returned to the frontend.
function loadSubs() {
  const rows = db.query("SELECT id, provider, label, created_at FROM subscriptions").all() as { id: string; provider: string; label: string; created_at: string }[];
  return rows.map(toPublic);
}

// Full row including the key, for server-side upstream calls only.
function getSub(id: string) {
  return db.query("SELECT id, provider, label, api_key, created_at FROM subscriptions WHERE id = ?").get(id) as SubRow | null;
}

async function fetchOpencodeGoUsage(apiKey) {
  const res = await fetch("https://opencode.ai/inference/go/v1/usage", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.usage;
}

async function fetchCommandcodeUsage(apiKey) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const [credits, subs, summary, whoami] = await Promise.all([
    fetch("https://api.commandcode.ai/alpha/billing/credits", { headers }).then(r => r.json()),
    fetch("https://api.commandcode.ai/alpha/billing/subscriptions", { headers }).then(r => r.json()),
    fetch("https://api.commandcode.ai/alpha/usage/summary", { headers }).then(r => r.json()),
    fetch("https://api.commandcode.ai/alpha/whoami?limits=1", { headers }).then(r => r.json()),
  ]);
  return { credits, subs, summary, whoami };
}

async function fetchOpencodeGoModels() {
  const res = await fetch("https://opencode.ai/inference/go/v1/models");
  const data = await res.json();
  return data.data.map(m => m.id);
}

async function fetchCommandcodeModels() {
  const res = await fetch("https://api.commandcode.ai/provider/v1/models");
  const data = await res.json();
  return data.data.map(m => ({ id: m.id, name: m.name, context: m.context_length }));
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === "darwin") cmd = `open ${url}`;
  else if (platform === "win32") cmd = `start ${url}`;
  else cmd = `xdg-open ${url}`;
  Bun.spawn(["sh", "-c", cmd]);
}

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/subscriptions" && req.method === "GET") {
      return Response.json(await loadSubs());
    }

    if (url.pathname === "/api/subscriptions" && req.method === "POST") {
      const body = await req.json();
      if (!body.apiKey) return Response.json({ error: "apiKey required" }, { status: 400 });
      const sub = { id: crypto.randomUUID(), provider: body.provider, label: body.label || body.provider, createdAt: new Date().toISOString() };
      db.run("INSERT INTO subscriptions (id, provider, label, api_key, created_at) VALUES (?,?,?,?,?)", [sub.id, sub.provider, sub.label, body.apiKey, sub.createdAt]);
      return Response.json(sub);
    }

    if (url.pathname.startsWith("/api/subscriptions/") && req.method === "DELETE") {
      const id = url.pathname.split("/").pop()!;
      db.run("DELETE FROM subscriptions WHERE id = ?", [id]);
      return Response.json({ ok: true });
    }

    if (url.pathname.startsWith("/api/usage/") && req.method === "GET") {
      const id = url.pathname.split("/").pop()!;
      const sub = getSub(id);
      if (!sub) return Response.json({ error: "not found" }, { status: 404 });
      try {
        if (sub.provider === "opencode-go") {
          return Response.json({ provider: "opencode-go", usage: await fetchOpencodeGoUsage(sub.api_key) });
        } else {
          return Response.json({ provider: "commandcode", usage: await fetchCommandcodeUsage(sub.api_key) });
        }
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    if (url.pathname === "/api/models/opencode-go" && req.method === "GET") {
      try { return Response.json(await fetchOpencodeGoModels()); }
      catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
    }

    if (url.pathname === "/api/models/commandcode" && req.method === "GET") {
      try { return Response.json(await fetchCommandcodeModels()); }
      catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      const file = Bun.file(new URL("./public/index.html", import.meta.url));
      if (await file.exists()) return new Response(file, { headers: { "Content-Type": "text/html" } });
      const fallback = Bun.file("./public/index.html");
      return new Response(fallback, { headers: { "Content-Type": "text/html" } });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Subscription Monitor running at http://localhost:${PORT}`);
openBrowser(`http://localhost:${PORT}`);
