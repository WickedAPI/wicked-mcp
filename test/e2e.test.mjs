// Boots the real HTTP server and talks to it with the SDK's own client.
// Needs network access (it loads the live services' OpenAPI specs).
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const PORT = 18080;
let proc;

test.before(async () => {
  proc = spawn(process.execPath, ["dist/http.js"], { env: { ...process.env, PORT: String(PORT), RATE_LIMIT_PER_MINUTE: "1000", ALLOWED_HOSTS: `localhost:${PORT},127.0.0.1:${PORT}` }, stdio: ["ignore", "ignore", "pipe"] });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server did not start")), 60_000);
    proc.stderr.on("data", (d) => String(d).includes("http on") && (clearTimeout(t), resolve()));
    proc.on("exit", (c) => reject(new Error("server exited " + c)));
  });
});
test.after(() => proc?.kill());

test("serves every tool over streamable HTTP and answers a live call", async () => {
  const c = new Client({ name: "e2e", version: "1" });
  await c.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${PORT}/mcp`)));
  const { tools } = await c.listTools();
  assert.ok(tools.length >= 105, `expected >= 105 tools, got ${tools.length}`);
  for (const n of ["reputation_leaderboard", "reputation_stake", "registry_key_info", "sanity_get_check", "identity_jwks", "memory_prepare", "paywall_signup", "filings_search", "wallet_check"]) {
    assert.ok(tools.some((t) => t.name === n), `missing tool ${n}`);
  }
  globalThis.__toolCount = tools.length;
  for (const p of ["reputation_", "registry_", "identity_", "sanity_", "memory_", "paywall_", "protocol_health", "broker_sync"]) {
    assert.ok(tools.some((t) => t.name.startsWith(p)), `missing ${p}*`);
  }
  const r = await c.callTool({ name: "reputation_tiers", arguments: {} });
  assert.equal(JSON.parse(r.content[0].text).http_status, 200);
  await c.close();
});

test("rejects bad Host, non-POST and unknown paths; /health is open", async () => {
  const base = `http://localhost:${PORT}`;
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await fetch(`${base}/mcp`)).status, 405);
  assert.equal((await fetch(`${base}/nope`)).status, 404);
  const status = await new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port: PORT, path: "/mcp", method: "POST", headers: { host: "evil.example", "content-type": "application/json" } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    r.on("error", reject);
    r.end("{}");
  });
  assert.equal(status, 421);
});

test("front door: landing page, llms.txt, server card, prompts and usage stats", async () => {
  const base = `http://localhost:${PORT}`;
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /Wicked MCP/);
  assert.match(html, new RegExp(`${globalThis.__toolCount} tools`));
  const llms = await (await fetch(`${base}/llms.txt`)).text();
  assert.match(llms, /claude mcp add --transport http wicked/);
  assert.match(llms, /memory_prepare/);
  const card = await (await fetch(`${base}/.well-known/mcp/server-card.json`)).json();
  assert.equal(card.tools.length, globalThis.__toolCount);
  assert.equal(card.transport.endpoint, "/mcp");

  const c = new Client({ name: "e2e2", version: "1" });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  const { prompts } = await c.listPrompts();
  for (const p of ["rug_check", "fact_check", "verify_agent", "find_reliable_tool", "agent_memory_guide"]) {
    assert.ok(prompts.some((x) => x.name === p), `missing prompt ${p}`);
  }
  const pr = await c.getPrompt({ name: "verify_agent", arguments: { wallet: "0x0000000000000000000000000000000000000001" } });
  assert.match(pr.messages[0].content.text, /identity_status/);
  await c.callTool({ name: "reputation_tiers", arguments: {} });
  await c.close();

  const stats = await (await fetch(`${base}/stats`)).json();
  assert.ok(stats.total_calls >= 1);
  assert.ok(stats.tools.some((t) => t.tool === "reputation_tiers"));
  assert.ok(!JSON.stringify(stats).includes("0x0000"), "stats must not contain arguments");
});

test("an unpaid priced call returns the decoded x402 price, not an empty error", async () => {
  const c = new Client({ name: "e2e3", version: "1" });
  await c.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${PORT}/mcp`)));
  const r = await c.callTool({ name: "atr", arguments: { symbol: "BTC" } });
  const body = JSON.parse(r.content[0].text);
  assert.equal(body.http_status, 402);
  assert.ok(body.payment_required?.accepts?.length, "payment_required must be decoded from the Payment-Required header");
  assert.ok(body.how_to_pay);
  assert.equal(r.isError, false, "a 402 is a price, not a tool failure");
  await c.close();
});

test("every tool has annotations, usage guidance and a behavior line (Glama tool-definition quality)", async () => {
  const c = new Client({ name: "e2e4", version: "1" });
  await c.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${PORT}/mcp`)));
  const { tools } = await c.listTools();
  const missingUse = tools.filter((t) => !/Use when /.test(t.description)).map((t) => t.name);
  const missingBehavior = tools.filter((t) => !/Behavior: /.test(t.description)).map((t) => t.name);
  const missingAnn = tools.filter((t) => !t.annotations || typeof t.annotations.readOnlyHint !== "boolean").map((t) => t.name);
  // Tools generated at boot from a service's OpenAPI spec may be new; they only need annotations and behavior.
  assert.deepEqual(missingAnn, []);
  assert.deepEqual(missingBehavior, []);
  assert.ok(missingUse.length <= 3, `tools without "Use when" guidance: ${missingUse.join(", ")}`);
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  assert.equal(byName.memory_delete.annotations.destructiveHint, true);
  assert.equal(byName.atr.annotations.readOnlyHint, true);
  assert.equal(byName.memory_store.annotations.readOnlyHint, false);
  assert.match(byName.sentiment.description, /free; no key or payment needed/);
  await c.close();
});
