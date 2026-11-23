// One-off: give the live demo sites their own llms.txt.
// node demos/llms-update.mjs            dry run for every site
// node demos/llms-update.mjs --confirm  write
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadConfig } from "../tools/lib/core.mjs";
import { rpc, toolPayload } from "../tools/lib/preflight.mjs";

const confirm = process.argv.includes("--confirm");
const cfg = loadConfig();
const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const token = process.env[cfg.agent.tokenEnv] ?? env[cfg.agent.tokenEnv];
const url = cfg.platform.mcpUrl;
const texts = JSON.parse(readFileSync(join(ROOT, "demos", "llms-update.json"), "utf8"));

async function call(name, args) {
  const r = await rpc(url, token, "tools/call", { name, arguments: args });
  if (!r.ok) throw new Error(`${name}: ${JSON.stringify(r.error)}`);
  const p = toolPayload(r.result);
  if (r.result?.isError) throw new Error(`${name}: ${typeof p === "string" ? p : JSON.stringify(p).slice(0, 600)}`);
  return p;
}

console.log(`platform ${url}, ${confirm ? "CONFIRM" : "dry run"}`);
for (const [siteId, llmsTxt] of Object.entries(texts)) {
  const exp = await call("export_site_bundle", { siteId });
  const manifest = { ...exp.manifest, llmsTxt };
  const args = { siteId, baseRevision: exp.lock?.revision, manifest, ...(confirm ? { confirm: true } : {}) };
  const res = await call("update_site", args);
  console.log(`\n== ${exp.manifest.siteName} (${siteId}) had llmsTxt: ${exp.manifest.llmsTxt ? "yes" : "no"}`);
  console.log(JSON.stringify({ summary: res.summary, notes: res.notes, llmsTxt: res.llmsTxt, revision: res.revision ?? res.lock?.revision }, null, 1).slice(0, 1500));
}
