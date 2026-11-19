#!/usr/bin/env node
// The studio's one command line. Agents call it; so can people.
//   node tools/studio.mjs <command> [...]
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT, StudioError, list, loadConfig, parseArgs, writeJson } from "./lib/core.mjs";

const [, , name, ...rest] = process.argv;
if (!existsSync(join(ROOT, "node_modules"))) {
  console.error("Dependencies are not installed yet. Run: npm install");
  process.exit(2);
}
const { createProject, listPipelines, loadPipeline, loadProject, logDecision, stageStates, writeCheckpoint } = await import("./lib/pipelines.mjs");

const HELP = `webto-studio

  setup                                   write .mcp.json from platform.config.json
  preflight [project]                     what this machine and token can do
  pipelines                               the pipelines and when to use each
  new <project> --pipeline <name> [--title "..."]
  status <project>                        which stage is next and what it needs
  check <project> [--strict]              compile the bundle with the platform's validator
  checkpoint <project> <stage> [--approved "<what the user said>"] [--note "..."]
  log <project> "<decision>"              add a line to the decision log
  shoot <project> --page <label>=<url> [--page ...] [--widths 390,768,1280] [--dark] [--reduced-motion] [--tag <name>]
  crawl <project> <url> --authorized [--max 20] [--render]
`;

const out = (v) => console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));

const commands = {
  async setup() {
    const cfg = loadConfig();
    const { mcpServerName, tokenEnv } = cfg.agent;
    writeJson(join(ROOT, ".mcp.json"), {
      mcpServers: { [mcpServerName]: { type: "http", url: cfg.platform.mcpUrl, headers: { Authorization: `Bearer \${${tokenEnv}}` } } },
    });
    out(`.mcp.json now points "${mcpServerName}" at ${cfg.platform.mcpUrl}`);
    out(process.env[tokenEnv] ? `${tokenEnv} is set.` : `${tokenEnv} is not set yet. Create a token in ${cfg.platform.dashboardUrl} (Settings, Security, Access tokens) and set it as an environment variable.`);
    out("Restart your agent so it picks up the MCP server, then ask it for a website.");
  },

  async preflight({ _: [slug] }) {
    const { preflight, summarize } = await import("./lib/preflight.mjs");
    const report = await preflight();
    if (slug) {
      const { dir } = loadProject(slug);
      writeJson(join(dir, "reports", "preflight.json"), report);
    }
    out(summarize(report));
    if (slug) out(`Written: projects/${slug}/reports/preflight.json`);
    if (!report.ok) process.exitCode = 1;
  },

  async pipelines() {
    for (const p of listPipelines()) {
      out(`${p.name}  (${p.title})\n  ${String(p.summary).trim().replace(/\s+/g, " ")}\n  Use when: ${p.use_when.join(" | ")}\n  Stages: ${p.stages.map((s) => s.name + (s.human_approval ? "*" : "")).join(" > ")}\n`);
    }
    out("* = stops for the user's approval");
  },

  async new({ _: [slug], flags }) {
    if (typeof flags.pipeline !== "string") throw new StudioError("Pass --pipeline <name>. See: node tools/studio.mjs pipelines");
    const { dir, pipeline } = createProject(slug, flags.pipeline, typeof flags.title === "string" ? flags.title : undefined);
    out(`Created ${relative(ROOT, dir)} with pipeline ${pipeline.name}.`);
    out(`First stage: ${pipeline.stages[0].name}. Read skills/${pipeline.stages[0].skill}.md`);
  },

  async status({ _: [slug] }) {
    const { dir, meta } = loadProject(slug);
    const pipeline = loadPipeline(meta.pipeline);
    const states = stageStates(dir, pipeline);
    out(`${meta.title}  (pipeline ${pipeline.name})`);
    for (const s of states) {
      const mark = s.state === "done" ? "done " : s.state === "stale" ? "STALE" : "     ";
      out(`  [${mark}] ${s.stage.name}${s.stage.human_approval ? "  (needs approval)" : ""}`);
    }
    const next = states.find((s) => s.state !== "done");
    if (!next) return out("\nEvery stage is checkpointed. The pipeline is complete.");
    const st = next.stage;
    out(`\nNext: ${st.name}${next.state === "stale" ? "  (an earlier stage was redone, so this one must be redone too)" : ""}`);
    out(`  Read: skills/${st.skill}.md${(st.extra_skills ?? []).map((x) => `, skills/${x}.md`).join("")}`);
    if (st.requires.length) out(`  Needs: ${st.requires.join(", ")}`);
    out(`  Produces: ${st.produces.join(", ") || "nothing on disk"}${st.review ? ", plus review/" + st.name + ".json" : ""}`);
    if (st.human_approval) out(`  Gate: show the user ${st.approval_shows}, and wait for a yes`);
    out(`  Done when:\n${st.success_criteria.map((c) => `    - ${c}`).join("\n")}`);
  },

  async check({ _: [slug], flags }) {
    const { checkBundle } = await import("./lib/check.mjs");
    const report = checkBundle(slug, { strict: flags.strict === true ? true : undefined });
    out(report.output);
    out(`\n${report.ok ? "PASS" : "FAIL"}  (${report.command})  written: projects/${slug}/reports/check.json`);
    if (!report.ok) process.exitCode = 1;
  },

  async checkpoint({ _: [slug, stage], flags }) {
    if (!stage) throw new StudioError("Usage: checkpoint <project> <stage>");
    const { checkpoint, next } = writeCheckpoint(slug, stage, { approved: flags.approved, note: flags.note });
    out(`Checkpoint written: ${stage} (revision ${checkpoint.revision}).`);
    out(next ? `Next stage: ${next.name}. Read skills/${next.skill}.md` : "That was the last stage.");
  },

  async log({ _: [slug, ...words] }) {
    const { dir } = loadProject(slug);
    if (!words.length) throw new StudioError('Usage: log <project> "<decision>"');
    logDecision(dir, { kind: "decision", text: words.join(" ") });
    out("Logged.");
  },

  async shoot({ _: [slug], flags }) {
    const { shoot } = await import("./lib/shoot.mjs");
    const widths = typeof flags.widths === "string" ? flags.widths.split(",").map(Number).filter((n) => n >= 240 && n <= 3840) : undefined;
    const index = await shoot(slug, {
      pages: list(flags.page),
      urls: list(flags.url),
      widths,
      dark: flags.dark === true,
      reducedMotion: flags["reduced-motion"] === true,
      tag: typeof flags.tag === "string" ? flags.tag : undefined,
    });
    out(`${index.shots.length} screenshot(s) in projects/${slug}/shots/. Open them: a clean report does not mean the page looks right.`);
    out(index.problems.length ? `Problems found:\n${index.problems.map((p) => `  - ${p}`).join("\n")}` : "No overflow, broken image or console error was measured.");
  },

  async crawl({ _: [slug, url], flags }) {
    if (!url) throw new StudioError("Usage: crawl <project> <url> --authorized");
    const { crawl } = await import("./lib/crawl.mjs");
    const { inventory, thin, leftInQueue } = await crawl(slug, url, { max: flags.max, authorized: flags.authorized === true, render: flags.render === true });
    out(`Read ${inventory.pages.length} page(s) from ${inventory.source_url}; skipped ${inventory.skipped.length}.`);
    for (const p of inventory.pages) out(`  ${p.path}  "${p.title}"  ${p.headings.length} headings, ${p.text_blocks.length} text blocks, ${p.images.length} images`);
    if (leftInQueue) out(`${leftInQueue} more link(s) were not read (limit reached). Raise --max if they matter.`);
    if (thin) out(`${thin} page(s) came back with no text. If the site builds its pages in the browser, run again with --render.`);
    out(`Written: projects/${slug}/content_inventory.json`);
  },
};

if (!name || name === "help" || name === "--help" || !commands[name]) {
  console.log(HELP);
  if (name && !["help", "--help"].includes(name)) process.exitCode = 2;
} else {
  try {
    await commands[name](parseArgs(rest));
  } catch (e) {
    if (e instanceof StudioError) {
      console.error(e.message);
      process.exitCode = 1;
    } else throw e;
  }
}
