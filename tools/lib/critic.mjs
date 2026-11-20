// The blind critic: a fresh agent that scores the real pages from screenshots
// alone, because the builder sees what it meant instead of what is on screen.
// This module writes the critic's brief and judges the critic's file; it never
// scores anything itself.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import { ROOT, StudioError, readJson } from "./core.mjs";

export const WEIGHTS = { design: 0.4, usability: 0.3, distinctiveness: 0.2, content: 0.1 };
export const RUBRIC = join(ROOT, "skills", "meta", "critic-rubric.md");
const DEFAULT_BAR = { overall: 7, min: 6, max_passes: 3 };

export function qualityBar(pipeline) {
  return { ...DEFAULT_BAR, ...(pipeline.quality_bar ?? {}) };
}

export function overallOf(scores) {
  let sum = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) sum += (Number(scores?.[k]?.score) || 0) * w;
  return Math.round(sum * 100) / 100;
}

export function listPasses(dir) {
  const d = join(dir, "critique");
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .map((f) => /^pass-(\d+)\.json$/.exec(f))
    .filter(Boolean)
    .map((m) => ({ n: Number(m[1]), file: `critique/${m[0]}` }))
    .sort((a, b) => a.n - b.n);
}

function readIndex(dir) {
  const p = join(dir, "shots", "index.json");
  return existsSync(p) ? readJson(p) : null;
}

/** Screenshots of real pages: local section previews are the builder's, not the visitor's. */
function visitorShots(index, pipeline) {
  // A template's dark option exists only as a local preview until a buyer switches to it.
  const darkOption = (s) => pipeline?.name === "template-for-sale" && s.local && s.tag === "local-dark";
  return (index?.shots ?? []).filter((s) => !s.local || darkOption(s));
}

function describe(s) {
  if (s.local && s.tag === "local-dark") return [s.label, `${s.width} px`, "the dark option a buyer can switch to, a preview of the sections without the site's chrome"].join(", ");
  return [s.label, `${s.width} px`, s.scheme === "dark" ? "dark" : "light", s.reducedMotion ? "reduced motion" : null].filter(Boolean).join(", ");
}

/** The brief for the next pass, with every path spelled out so the critic needs nothing else. */
export function criticBrief(dir, pipeline) {
  const index = readIndex(dir);
  if (!index) throw new StudioError("No screenshots yet. Capture the draft's real pages with \"studio shoot\" first");
  const shots = visitorShots(index, pipeline);
  if (!shots.some((s) => !s.local)) throw new StudioError("Only local previews were captured. Capture the draft's real pages with \"studio shoot\"");
  const bar = qualityBar(pipeline);
  const passes = listPasses(dir);
  const last = passes.at(-1);
  let n = (last?.n ?? 0) + 1;
  if (last) {
    let earlier = null;
    try {
      earlier = readJson(join(dir, last.file));
    } catch {}
    // An unreadable or malformed pass is redone under its own number; a valid one is final,
    // so a score cannot be re-rolled on the same screenshots.
    if (!earlier || schemaErrors(earlier).length) n = last.n;
    else if (earlier.shots_at === index.at) {
      throw new StudioError(`Pass ${last.n} already judged these screenshots. A new pass needs new screenshots, taken after the fixes`);
    }
  }
  if (n > bar.max_passes) {
    throw new StudioError(
      `${bar.max_passes} critic passes are done. Show the user the last scores and the fixes still open ("studio critic <project> --result"), and ask whether to accept the site as it is (checkpoint verify --below-bar "<what they said>") or what to change`,
    );
  }
  const out = join(dir, "critique", `pass-${n}.json`);
  const lines = [];
  for (const s of shots) {
    if (s.fold) lines.push(`  ${join(dir, s.fold)}  (${describe(s)}, first screen)`);
    // A long page is read in parts at real size; the whole-page file would be shrunk past reading.
    if (s.parts?.length) s.parts.forEach((p, i) => lines.push(`  ${join(dir, p)}  (${describe(s)}, part ${i + 1} of ${s.parts.length}, top to bottom)`));
    else lines.push(`  ${join(dir, s.file)}  (${describe(s)}, whole page)`);
  }
  const text = `You are judging a website you have never seen. You get only evidence: screenshots and measurements.

1. Read the rubric: ${RUBRIC}
2. Open every screenshot below. All of them.
${lines.join("\n")}
3. The measurements for each screenshot (sideways overflow in px, images that failed to load, console errors, the page title) are in:
  ${join(dir, "shots", "index.json")}

Open nothing else. Do not visit the site, search the web, or read any other file in that folder or the folders around it: no brief, plan, design notes, code, decision log or earlier critique. What these files cannot show, list in "not_judged".

Write your verdict as JSON, in the shape the rubric's "The file" section gives, to:
  ${out}
with "pass": ${n}, "critic": "subagent", "shots_at": "${index.at}". Write evidence paths relative to the project folder, for example "${shots[0].fold ?? shots[0].file}".

Then reply with one line: the file is written, and your one-sentence reading of the site's idea.`;
  return { n, max: bar.max_passes, out, text };
}

let validate;
function schemaErrors(data) {
  validate ??= new Ajv({ allErrors: true, strict: false }).compile(readJson(join(ROOT, "schemas", "critique.schema.json")));
  return validate(data) ? [] : validate.errors.slice(0, 8).map((e) => `${e.instancePath || "(root)"}: ${e.message}`);
}

/**
 * Judge the latest pass against the screenshots on disk and the pipeline's bar.
 * `belowBar` is what the user said when they accepted a site under the bar.
 */
export function judgeCritique(dir, pipeline, { belowBar } = {}) {
  const problems = [];
  const warnings = [];
  const bar = qualityBar(pipeline);
  const passes = listPasses(dir);
  if (!passes.length) {
    problems.push('No critique yet. Run "studio critic <project>" and give the brief to a fresh agent');
    return { problems, warnings, bar };
  }
  const last = passes.at(-1);
  let data;
  try {
    data = readJson(join(dir, last.file));
  } catch (e) {
    problems.push(e.message);
    return { problems, warnings, bar, last };
  }
  for (const e of schemaErrors(data)) problems.push(`${last.file}${e}`);
  if (problems.length) return { problems, warnings, bar, last, data };
  if (data.pass !== last.n) problems.push(`${last.file}: "pass" is ${data.pass}, the file name says ${last.n}`);
  const index = readIndex(dir);
  if (!index || data.shots_at !== index.at) {
    problems.push(`${last.file}: the screenshots changed after this critique. Run "studio critic <project>" for a new pass on the current ones`);
  }
  for (const [k, v] of Object.entries(data.scores)) {
    for (const ev of v.evidence) {
      if (!existsSync(join(dir, ...ev.file.split("/")))) problems.push(`${last.file}: ${k} cites ${ev.file}, which does not exist`);
    }
  }
  const overall = overallOf(data.scores);
  const under = Object.keys(WEIGHTS).filter((k) => data.scores[k].score < bar.min);
  const quote = typeof belowBar === "string" ? belowBar.trim() : "";
  const met = overall >= bar.overall && !under.length;
  if (!met) {
    const why = `overall ${overall}, the bar is ${bar.overall} with every criterion at least ${bar.min}${under.length ? ` (under: ${under.join(", ")})` : ""}`;
    if (quote.length >= 2) warnings.push(`Accepted under the bar by the user: ${why}`);
    else {
      problems.push(
        last.n >= bar.max_passes
          ? `Critique pass ${last.n}: ${why}. That was the last pass. Show the user the scores and the open fixes, and checkpoint with --below-bar "<what they said>" if they accept it`
          : `Critique pass ${last.n}: ${why}. Work through the fixes, capture again, and run a new pass with a new critic`,
      );
    }
  }
  if (data.critic === "self") warnings.push("The critique is a self-score, not an independent one. Say so when you report to the user");
  const summary = {
    pass: last.n,
    critic: data.critic,
    overall,
    scores: Object.fromEntries(Object.keys(WEIGHTS).map((k) => [k, data.scores[k].score])),
    met,
    ...(!met && quote ? { below_bar: quote } : {}),
  };
  return { problems, warnings, bar, last, data, summary };
}
