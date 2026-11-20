#!/usr/bin/env node
// Before/after eval: the same five short requests built by two versions of the
// studio, then scored by one blind critic from the current version. The scores
// say whether the design-quality work raised quality, and where the critic's
// bar (quality_bar) should sit.
//
//   node evals/before-after/run.mjs brief <case>                 the builder's task for one case
//   node evals/before-after/run.mjs collect <version> <worktree> copy each eval-<case>/eval-result.json
//   node evals/before-after/run.mjs shoot [--again]              fresh preview links, blind codes, screenshots
//   node evals/before-after/run.mjs report                       scores by case and version, and candidate bars
//
// Needs WEBTO_TOKEN (and WEBTO_MCP_URL for staging) in the environment or .env for `shoot`.
import { existsSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { loadConfig, loadDotEnv, readJson, writeJson, projectsDir } from "../../tools/lib/core.mjs";

loadDotEnv();
const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");
const VERSIONS = ["before", "after"];
const cases = readJson(join(HERE, "cases.json")).cases;

function caseOf(id) {
  const c = cases.find((x) => x.id === id);
  if (!c) throw new Error(`No case "${id}". Cases: ${cases.map((x) => x.id).join(", ")}`);
  return c;
}

function brief(id) {
  const c = caseOf(id);
  const answers = Object.entries(c.answers).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  return `You are being evaluated on how good a website you build from a short request.
Work in this repository exactly as AGENT_GUIDE.md tells you to for a real user,
with these differences only:

- The user is away. Whenever you would ask them something, take the answer
  from "Answers" below. Anything not there is "belum ada". Do not invent facts.
- At every approval gate, write what you would have shown the user to
  projects/eval-${id}/eval-gates.md (append, one heading per gate), then go on
  as if they replied "ya, lanjut". Use that as the --approved text.
- Spend nothing: no image or 3D generation, no paid keys. Stock photos only
  through keys already in .env.
- Never publish. Do not call publish_site. Stop after the last stage before
  publishing, with the site saved as a draft.
- Name the project eval-${id}. When you stop, write
  projects/eval-${id}/eval-result.json:
  {"site_id": "...", "stages_done": ["..."], "pages": [{"title": "...", "slug": "..."}], "notes": "anything that went wrong"}

Request from the user: "${c.prompt}"

Answers:
${answers}
`;
}

function collect(version, worktree) {
  if (!VERSIONS.includes(version)) throw new Error(`version is ${VERSIONS.join(" or ")}`);
  mkdirSync(RUNS, { recursive: true });
  for (const c of cases) {
    const p = join(worktree, "projects", `eval-${c.id}`, "eval-result.json");
    if (!existsSync(p)) {
      console.log(`${c.id}/${version}: no eval-result.json at ${p}`);
      continue;
    }
    const r = readJson(p);
    writeJson(join(RUNS, `${c.id}-${version}.json`), { case: c.id, version, ...r });
    console.log(`${c.id}/${version}: site ${r.site_id}, ${r.pages?.length ?? "?"} pages, stages ${r.stages_done?.join(", ")}`);
  }
}

async function previewPages(siteId) {
  const { rpc, toolPayload } = await import("../../tools/lib/preflight.mjs");
  const cfg = loadConfig();
  const token = process.env[cfg.agent.tokenEnv];
  if (!token) throw new Error(`${cfg.agent.tokenEnv} is not set`);
  const r = await rpc(cfg.platform.mcpUrl, token, "tools/call", { name: "get_preview_url", arguments: { siteId } });
  if (!r.ok) throw new Error(`get_preview_url ${siteId}: ${typeof r.error === "string" ? r.error : JSON.stringify(r.error)}`);
  const p = toolPayload(r.result);
  if (p?.url) console.log(`WARNING: site ${siteId} is published at ${p.url}; an eval site must stay a draft`);
  return p?.previewPages ?? [];
}

// Every site gets a code the critic cannot read a version from. The key stays here.
async function shoot(again = false) {

  const { createProject } = await import("../../tools/lib/pipelines.mjs");
  const { shoot: capture } = await import("../../tools/lib/shoot.mjs");
  const keyFile = join(RUNS, "key.json");
  const key = existsSync(keyFile) ? readJson(keyFile) : {};
  const runs = existsSync(RUNS) ? readdirSync(RUNS).filter((f) => /^[a-z-]+-(before|after)\.json$/.test(f)) : [];
  for (const f of runs) {
    const run = readJson(join(RUNS, f));
    const name = `${run.case}-${run.version}`;
    const code = Object.keys(key).find((k) => key[k] === name) ?? `x${randomBytes(3).toString("hex")}`;
    key[code] = name;
    writeJson(keyFile, key);
    const slug = `eval-${code}`;
    if (!existsSync(join(projectsDir(), slug))) createProject(slug, "client-site", `Eval ${code}`);
    if (!again && existsSync(join(projectsDir(), slug, "shots", "index.json"))) {
      console.log(`${code}: already captured`);
      continue;
    }
    const pages = await previewPages(run.site_id);
    if (!pages.length) {
      console.log(`${code}: no preview pages for site ${run.site_id}`);
      continue;
    }
    const labels = new Set();
    const list = pages.map((p, i) => {
      let label = i === 0 ? "home" : String(p.slug || `page${i}`).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      while (labels.has(label)) label += "-2";
      labels.add(label);
      return `${label}=${p.url}`;
    });
    await capture(slug, { pages: list });
    console.log(`${code}: ${list.length} pages captured. Critic: node tools/studio.mjs critic ${slug}`);
  }
}

const CRITERIA = ["design", "usability", "distinctiveness", "content"];

async function report() {
  const { overallOf } = await import("../../tools/lib/critic.mjs");
  const keyFile = join(RUNS, "key.json");
  if (!existsSync(keyFile)) throw new Error("No key.json yet. Run shoot first");
  const key = readJson(keyFile);
  const rows = [];
  for (const [code, name] of Object.entries(key)) {
    const m = /^(.+)-(before|after)$/.exec(name);
    const { listPasses } = await import("../../tools/lib/critic.mjs");
    const last = listPasses(join(projectsDir(), `eval-${code}`)).at(-1);
    const passFile = join(projectsDir(), `eval-${code}`, last?.file ?? "critique/pass-1.json");
    if (!existsSync(passFile)) {
      console.log(`${code} (${name}): no critique yet`);
      continue;
    }
    const pass = readJson(passFile);
    const scores = Object.fromEntries(CRITERIA.map((k) => [k, Number(pass.scores?.[k]?.score)]));
    rows.push({ case: m[1], version: m[2], code, overall: overallOf(pass.scores), ...scores });
  }
  if (!rows.length) return console.log("No critiques yet.");
  const fmt = (n) => (Number.isFinite(n) ? n.toFixed(2) : "  - ");
  console.log(`case          version  overall  ${CRITERIA.join("  ")}`);
  for (const r of rows.sort((a, b) => a.case.localeCompare(b.case) || a.version.localeCompare(b.version))) {
    console.log(`${r.case.padEnd(13)} ${r.version.padEnd(8)} ${fmt(r.overall).padStart(7)}  ${CRITERIA.map((k) => fmt(r[k]).padStart(k.length)).join("  ")}`);
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log("");
  for (const v of VERSIONS) {
    const rs = rows.filter((r) => r.version === v);
    if (!rs.length) continue;
    console.log(`${v.padEnd(7)} mean overall ${fmt(mean(rs.map((r) => r.overall)))}; ${CRITERIA.map((k) => `${k} ${fmt(mean(rs.map((r) => r[k])))}`).join(", ")}`);
  }
  const paired = cases.map((c) => [rows.find((r) => r.case === c.id && r.version === "before"), rows.find((r) => r.case === c.id && r.version === "after")]).filter(([a, b]) => a && b);
  if (paired.length) {
    const d = paired.map(([a, b]) => b.overall - a.overall);
    console.log(`after minus before, per case: ${d.map(fmt).join(", ")}; better in ${d.filter((x) => x > 0).length} of ${d.length}`);
  }
  console.log("\nCandidate bars (overall / every criterion at least): sites passing, before vs after");
  for (const overall of [6, 6.5, 7, 7.5, 8]) {
    for (const min of [5, 6, 7]) {
      const passes = (v) => rows.filter((r) => r.version === v && r.overall >= overall && CRITERIA.every((k) => r[k] >= min)).length;
      const n = (v) => rows.filter((r) => r.version === v).length;
      console.log(`  ${String(overall).padEnd(3)} / ${min}:  before ${passes("before")}/${n("before")}   after ${passes("after")}/${n("after")}`);
    }
  }
}

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === "brief") console.log(brief(args[0]));
  else if (cmd === "collect") collect(args[0], args[1]);
  else if (cmd === "shoot") await shoot(args.includes("--again"));
  else if (cmd === "report") await report();
  else console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 11).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
