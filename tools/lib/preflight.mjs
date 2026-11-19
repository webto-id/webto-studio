// What this machine and this token can do, found out before any work starts.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadConfig, now } from "./core.mjs";

const CORE_SKILLS = ["html-to-webto-variant", "webto-website", "html-to-webto-template", "webto-3d-effects"];

async function rpc(url, token, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {}
  if (!res.ok) return { ok: false, status: res.status, error: body?.error ?? text.slice(0, 200) };
  if (body?.error) return { ok: false, status: res.status, error: body.error.message ?? body.error };
  return { ok: true, result: body?.result };
}

/** A tool result arrives as text content; most of the platform's are JSON. */
function toolPayload(result) {
  const text = result?.content?.find?.((c) => c.type === "text")?.text;
  if (text === undefined) return result ?? null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function browserState() {
  try {
    const { chromium } = await import("playwright");
    const path = chromium.executablePath();
    return existsSync(path) ? { available: true } : { available: false, fix: "npm run setup:browser" };
  } catch {
    return { available: false, fix: "npm install && npm run setup:browser" };
  }
}

export async function preflight() {
  const cfg = loadConfig();
  const { mcpUrl } = cfg.platform;
  const { tokenEnv, tokenPrefix, mcpServerName } = cfg.agent;
  const report = { at: now(), platform: cfg.platform.name, mcpUrl, problems: [], notes: [] };

  const major = Number(process.versions.node.split(".")[0]);
  report.node = { version: process.versions.node, ok: major >= 20 };
  if (!report.node.ok) report.problems.push("Node 20 or newer is required");

  report.skills = Object.fromEntries(CORE_SKILLS.map((s) => [s, existsSync(join(ROOT, "skills", "core", s, "SKILL.md"))]));
  const missing = CORE_SKILLS.filter((s) => !report.skills[s]);
  if (missing.length) report.problems.push(`Core skill(s) missing under skills/core: ${missing.join(", ")}`);

  const mcpFile = join(ROOT, ".mcp.json");
  const configured = existsSync(mcpFile) ? JSON.parse(readFileSync(mcpFile, "utf8")).mcpServers?.[mcpServerName]?.url : undefined;
  report.mcpConfig = { url: configured ?? null, matches: configured === mcpUrl };
  if (!report.mcpConfig.matches) report.problems.push(`.mcp.json points the "${mcpServerName}" server at ${configured ?? "nothing"}, the tools use ${mcpUrl}. Run: npm run setup`);

  report.browser = await browserState();
  if (!report.browser.available) report.notes.push(`No browser for screenshots (${report.browser.fix}). Visual checks must then be reported as not done.`);

  const { imageSetup } = await import("./image.mjs");
  report.images = imageSetup();
  if (report.images.problem) report.notes.push(report.images.problem);
  if (!report.images.configured.length) report.notes.push("No image provider key in .env. Images come from the user's own files or stock stand-ins unless you can make images yourself.");
  const { stockSetup } = await import("./stock.mjs");
  report.stock = stockSetup();
  if (report.stock.problem) report.notes.push(report.stock.problem);

  const token = process.env[tokenEnv]?.trim();
  report.token = { present: Boolean(token) };
  if (!token) {
    report.problems.push(`${tokenEnv} is not set. Create a token in the dashboard (${cfg.platform.dashboardUrl}, Settings, Security, Access tokens) and set it as an environment variable. Never paste it into the chat.`);
    return finish(report);
  }
  if (!token.startsWith(tokenPrefix)) report.notes.push(`${tokenEnv} does not start with "${tokenPrefix}". Check that it is an agent access token.`);

  const tools = await rpc(mcpUrl, token, "tools/list").catch((e) => ({ ok: false, error: e.message }));
  if (!tools.ok) {
    report.token.works = false;
    report.problems.push(
      tools.status === 401 || tools.status === 403
        ? "The platform refused the token (expired, revoked, or without a read scope). Create a new one."
        : `Could not reach the platform at ${mcpUrl}: ${typeof tools.error === "string" ? tools.error : JSON.stringify(tools.error)}`,
    );
    return finish(report);
  }
  const names = (tools.result?.tools ?? []).map((t) => t.name);
  report.token.works = true;
  report.tools = names;
  const has = (n) => names.includes(n);
  report.can = {
    readSites: has("list_my_sites"),
    writeSites: has("create_site"),
    publishSites: has("publish_site"),
    writeTemplates: has("create_template_draft"),
    manageListings: has("create_template_listing"),
    uploadAssets: has("begin_asset_upload"),
  };
  if (!report.can.publishSites) report.notes.push("The token cannot publish. The user presses Publish in the dashboard.");

  if (has("get_plan_limits")) {
    const limits = await rpc(mcpUrl, token, "tools/call", { name: "get_plan_limits", arguments: {} }).catch((e) => ({ ok: false, error: e.message }));
    report.limits = limits.ok ? toolPayload(limits.result) : { error: limits.error };
  }
  return finish(report);
}

function finish(report) {
  report.ok = report.problems.length === 0;
  return report;
}

export function summarize(report) {
  const lines = [`Platform: ${report.platform} (${report.mcpUrl})`];
  lines.push(`Node ${report.node.version}: ${report.node.ok ? "ok" : "too old"}`);
  lines.push(`Token: ${!report.token.present ? "not set" : report.token.works ? "works" : "refused or unreachable"}`);
  if (report.can) {
    const yes = Object.entries(report.can).filter(([, v]) => v).map(([k]) => k);
    const no = Object.entries(report.can).filter(([, v]) => !v).map(([k]) => k);
    lines.push(`Can: ${yes.join(", ") || "nothing"}`);
    if (no.length) lines.push(`Cannot: ${no.join(", ")}`);
  }
  lines.push(`Browser for screenshots: ${report.browser.available ? "yes" : "no"}`);
  lines.push(`Image generation: ${report.images.default ? `${report.images.default.label}, model ${report.images.default.model}` : "not configured"}`);
  lines.push(`Stock photo search: ${report.stock.configured.length ? report.stock.configured.map((s) => s.label).join(", ") : "not configured (the platform still picks photos for __IMG__: stand-ins)"}`);
  for (const p of report.problems) lines.push(`PROBLEM: ${p}`);
  for (const n of report.notes) lines.push(`Note: ${n}`);
  return lines.join("\n");
}
