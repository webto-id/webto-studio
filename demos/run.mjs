#!/usr/bin/env node
// The README gallery builds: one brief per case for a fresh agent session, and a
// summary of what each build cost once it is done.
//
//   node demos/run.mjs brief <case>     the builder's task
//   node demos/run.mjs summary          time, turns and cost per finished build (from demos/logs)
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(HERE, "cases.json"), "utf8"));

function brief(id) {
  const c = data.cases.find((x) => x.id === id);
  if (!c) throw new Error(`No case "${id}". Cases: ${data.cases.map((x) => x.id).join(", ")}`);
  const answers = Object.entries(c.answers).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  const site = c.pipeline !== "template-for-sale";
  return `You are building a demo for the studio's README gallery, on the live platform.
Work in this repository exactly as AGENT_GUIDE.md tells you to for a real
user, with the pipeline "${c.pipeline}", and these differences only:

- The user is away. Whenever you would ask them something, take the answer
  from "Answers" below. Anything not there is "belum ada". Do not invent facts.
- The business is fictional. Put "${data.demo_note}" in the footer of every
  page, small but readable. Phone: show "${data.phone}"; WhatsApp links use
  wa.me/${data.whatsapp}. Never use a number that could be someone's.
- At every approval gate, write what you would have shown the user to
  projects/demo-${c.id}/demo-gates.md (one heading per gate), then go on as if
  they replied "ya, lanjut", and use that as the --approved text.
- Images: generate them with "studio image" on the configured provider. The
  owner approved the budget: run "studio image-budget demo-${c.id} --max 30
  --approved \\"pemilik: tanpa batas, model gratis sampai 28 November\\"" once.
  Follow skills/meta/images.md: never a real-looking face of a child, no
  impossible hands or bodies (open every image and redo a bad one). They may
  be photographic or illustrated, whichever suits the concept; the footer
  already says the business is fictional, so images need no label of their
  own. Never a recognisable real person.
- The blind critic runs as the verify stage says, up to its passes.
${site
    ? `- Publish: you may publish, with subdomain "${c.subdomain}" (check_subdomain first;
  if it is taken, add "-2"). Stop after publishing; skip the handoff stage.`
    : `- Template: create the template draft and a listing as a DRAFT with price 0;
  never publish the listing. Stop after the listing stage.`}
- Name the project demo-${c.id}. When you stop, write projects/demo-${c.id}/demo-result.json:
  {"site_id": "...", "url": "the public or preview URL", "pages": [...], "critic_overall": 0, "images": 0, "notes": "..."}

Request from the user: "${c.prompt}"

Answers:
${answers}
`;
}

function summary() {
  const dir = join(HERE, "logs");
  if (!existsSync(dir)) return console.log("No logs yet.");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
    const lines = readFileSync(join(dir, f), "utf8").trim().split("\n");
    const results = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((j) => j?.type === "result");
    if (!results.length) { console.log(`${f}: running`); continue; }
    const cost = results.at(-1).total_cost_usd ?? 0;
    const minutes = results.reduce((a, r) => a + (r.duration_ms ?? 0), 0) / 60000;
    const turns = results.reduce((a, r) => a + (r.num_turns ?? 0), 0);
    console.log(`${f.replace(".jsonl", "").padEnd(16)} ${minutes.toFixed(0).padStart(3)} min  ${String(turns).padStart(4)} turns  $${cost.toFixed(2)}`);
  }
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "brief") console.log(brief(arg));
else if (cmd === "summary") summary();
else console.log("node demos/run.mjs brief <case> | summary");
