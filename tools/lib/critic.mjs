// The blind critic: a fresh agent that scores the real pages from screenshots
// alone, because the builder sees what it meant instead of what is on screen.
// This module writes the critic's brief and judges the critic's file; it never
// scores anything itself.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import { ROOT, StudioError, now, readJson, writeJson } from "./core.mjs";

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

/**
 * Rounds the user opened after the passes ran out ("fix these, then judge it again").
 * Each round allows max_passes more. Only the user opens one, and only once the passes
 * are spent, so a score is never re-rolled by the builder.
 */
function readRounds(dir) {
  const p = join(dir, "critique", "rounds.json");
  return existsSync(p) ? (readJson(p).rounds ?? []) : [];
}

export function passLimit(dir, bar) {
  return bar.max_passes * (1 + readRounds(dir).length);
}

/** Open a new round of passes with the user's own words. Refused while passes remain. */
export function openRound(dir, pipeline, said) {
  const quote = typeof said === "string" ? said.trim() : "";
  if (quote.length < 2) throw new StudioError('--more-passes takes what the user said, e.g. --more-passes "ok, perbaiki lalu nilai ulang"');
  const bar = qualityBar(pipeline);
  const done = listPasses(dir).at(-1)?.n ?? 0;
  const limit = passLimit(dir, bar);
  if (done < limit) throw new StudioError(`${limit - done} critic pass(es) are still open in this round. More are opened only after the last one, by the user`);
  const rounds = [...readRounds(dir), { at: now(), after_pass: done, said: quote }];
  writeJson(join(dir, "critique", "rounds.json"), { rounds });
  return { from: done + 1, to: passLimit(dir, bar) };
}

function readIndex(dir) {
  const p = join(dir, "shots", "index.json");
  return existsSync(p) ? readJson(p) : null;
}

/** When the motion was last measured, or null when it never was. */
function readMotionAt(dir) {
  const p = join(dir, "motion", "index.json");
  return existsSync(p) ? (readJson(p).at ?? null) : null;
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
    else if (earlier.shots_at === index.at && (earlier.motion_at ?? null) === readMotionAt(dir)) {
      throw new StudioError(`Pass ${last.n} already judged these screenshots. A new pass needs new screenshots (or a new motion run), taken after the fixes`);
    }
  }
  const limit = passLimit(dir, bar);
  if (n > limit) {
    throw new StudioError(
      `${limit} critic passes are done. Show the user the last scores and the fixes still open ("studio critic <project> --result"), and ask whether to accept the site as it is (checkpoint verify --below-bar "<what they said>") or what to change. If they ask for changes and a new judgement, open a round with their words: critic <project> --more-passes "<what they said>"`,
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
  // Motion frames, when the site was measured moving: two per spot, as it enters and once settled.
  const motionPath = join(dir, "motion", "index.json");
  const motionIndex = existsSync(motionPath) ? readJson(motionPath) : null;
  const motionLines = [];
  for (const r of motionIndex?.runs ?? []) {
    for (const f of r.frames ?? []) {
      const where = `${r.label}, ${r.width} px${r.reducedMotion ? ", reduced motion" : ""}, scrolled to ${f.y} px (${f.why})`;
      if (f.enter) motionLines.push(`  ${join(dir, f.enter)}  (${where}: the moment it comes into view)`);
      if (f.settled) motionLines.push(`  ${join(dir, f.settled)}  (${where}: 0.7 s later, at rest)`);
    }
  }
  const motionStep = motionLines.length
    ? [
        "4. How the site moves: pairs of frames at each spot that moves, scrolled on a phone slowed to a mid-range Android's and on a laptop. Open them all:",
        ...motionLines,
        "   The motion measurements (slow frames, blocked time, layout shift, pins, empty canvases, entrance effects that never ran) are in:",
        `  ${motionPath}`,
      ].join("\n") + "\n"
    : "";
  // A template draft holds the pages, not the site's database: its blog and product lists
  // are empty unless the bundle ships samples. Critics scored the empty blog as the site's
  // worst fault three passes running, for a list that fills the moment it is applied.
  const templateDraft = pipeline?.name === "template-for-sale" || existsSync(join(dir, "template", "webto.lock.json"));
  const draftNote = templateDraft
    ? "These pages are a template draft: blog posts and products live in the database of the site the template is applied to, not in the template. An empty or near-empty blog or product list here is not a fault of the design; do not score it, and name it in \"not_judged\". Judge how the list looks when it has items only if a screenshot shows items.\n"
    : "";
  const stamp = `"pass": ${n},"critic": "subagent", "shots_at": "${index.at}"${motionIndex ? `, "motion_at": "${motionIndex.at}"` : ""}`;
  const text = `You are judging a website you have never seen. You get only evidence: screenshots and measurements.

1. Read the rubric: ${RUBRIC}
2. Open every screenshot below. All of them.
${lines.join("\n")}
3. The measurements for each screenshot (sideways overflow in px, images that failed to load, console errors, the page title, and "scrollStrips": parts that scroll sideways inside themselves, with how many items are out of view) are in:
  ${join(dir, "shots", "index.json")}
${motionStep}${draftNote}
Open nothing else. Do not visit the site, search the web, or read any other file in that folder or the folders around it: no brief, plan, design notes, code, decision log or earlier critique. What these files cannot show, list in "not_judged".

Write your verdict as JSON, in the shape the rubric's "The file" section gives, to:
  ${out}
with ${stamp}. Write evidence paths relative to the project folder, for example "${shots[0].fold ?? shots[0].file}".

Then reply with one line: the file is written, and your one-sentence reading of the site's idea.`;
  return { n, max: limit, out, text };
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
  const motionAt = readMotionAt(dir);
  if (motionAt && data.motion_at !== motionAt) {
    problems.push(`${last.file}: the motion was measured again after this critique, or the critic never saw it. Run "studio critic <project>" for a new pass`);
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
        last.n >= passLimit(dir, bar)
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
