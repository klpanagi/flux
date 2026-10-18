import { serve } from "bun";

const PORT = 3000;
const DATA_FILE = "./subscriptions.json";

async function loadSubs() {
  try {
    const file = Bun.file(DATA_FILE);
    if (await file.exists()) return await file.json();
  } catch {}
  return [];
}

async function saveSubs(subs) {
  await Bun.write(DATA_FILE, JSON.stringify(subs, null, 2));
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
      const subs = await loadSubs();
      const sub = { id: crypto.randomUUID(), provider: body.provider, label: body.label || body.provider, apiKey: body.apiKey, createdAt: new Date().toISOString() };
      subs.push(sub);
      await saveSubs(subs);
      return Response.json(sub);
    }

    if (url.pathname.startsWith("/api/subscriptions/") && req.method === "DELETE") {
      const id = url.pathname.split("/").pop();
      const subs = await loadSubs();
      await saveSubs(subs.filter(s => s.id !== id));
      return Response.json({ ok: true });
    }

    if (url.pathname.startsWith("/api/usage/") && req.method === "GET") {
      const id = url.pathname.split("/").pop();
      const subs = await loadSubs();
      const sub = subs.find(s => s.id === id);
      if (!sub) return Response.json({ error: "not found" }, { status: 404 });
      try {
        if (sub.provider === "opencode-go") {
          return Response.json({ provider: "opencode-go", usage: await fetchOpencodeGoUsage(sub.apiKey) });
        } else {
          return Response.json({ provider: "commandcode", usage: await fetchCommandcodeUsage(sub.apiKey) });
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
