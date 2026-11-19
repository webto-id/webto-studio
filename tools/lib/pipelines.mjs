// Pipeline manifests, projects, and the checkpoint rules that bind an agent to them.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import YAML from "yaml";
import { ROOT, SLUG_RE, StudioError, hashBundle, now, projectsDir, readJson, writeJson } from "./core.mjs";
import { judgeCritique } from "./critic.mjs";

const DEFS = join(ROOT, "pipeline_defs");
const SCHEMAS = join(ROOT, "schemas");

export function listPipelines() {
  return readdirSync(DEFS)
    .filter((f) => f.endsWith(".yaml") && !f.startsWith("_"))
    .map((f) => loadPipeline(f.slice(0, -5)));
}

export function loadPipeline(name) {
  const path = join(DEFS, `${name}.yaml`);
  if (!SLUG_RE.test(name) || !existsSync(path)) {
    const known = readdirSync(DEFS).filter((f) => f.endsWith(".yaml") && !f.startsWith("_")).map((f) => f.slice(0, -5));
    throw new StudioError(`Unknown pipeline "${name}". Known: ${known.join(", ")}`);
  }
  const p = YAML.parse(readFileSync(path, "utf8"));
  for (const s of p.stages) {
    s.requires ??= [];
    s.produces ??= [];
  }
  return p;
}

export function loadArtifacts() {
  return YAML.parse(readFileSync(join(DEFS, "_artifacts.yaml"), "utf8"));
}

export function artifactPath(projectDir, pipeline, name, stage) {
  const def = loadArtifacts()[name];
  if (!def) throw new StudioError(`Pipeline "${pipeline.name}" names an unknown artifact "${name}"`);
  const rel = def.path.replaceAll("{bundle}", pipeline.bundle).replaceAll("{stage}", stage);
  return { def, rel, abs: join(projectDir, ...rel.split("/")) };
}

export function projectDir(slug) {
  if (!SLUG_RE.test(slug ?? "")) throw new StudioError(`Project name must be lowercase words joined by hyphens, got "${slug}"`);
  return join(projectsDir(), slug);
}

export function loadProject(slug) {
  const dir = projectDir(slug);
  if (!existsSync(join(dir, "project.json"))) throw new StudioError(`No project "${slug}". Create it: node tools/studio.mjs new ${slug} --pipeline <name>`);
  return { dir, meta: readJson(join(dir, "project.json")) };
}

export function createProject(slug, pipelineName, title) {
  const dir = projectDir(slug);
  if (existsSync(join(dir, "project.json"))) throw new StudioError(`Project "${slug}" already exists`);
  const pipeline = loadPipeline(pipelineName);
  mkdirSync(dir, { recursive: true });
  const meta = { slug, pipeline: pipeline.name, pipelineVersion: pipeline.version, title: title ?? slug, createdAt: now(), seq: 0 };
  writeJson(join(dir, "project.json"), meta);
  logDecision(dir, { kind: "project", text: `Created with pipeline ${pipeline.name}` });
  return { dir, meta, pipeline };
}

export function logDecision(dir, entry) {
  appendFileSync(join(dir, "decision_log.jsonl"), JSON.stringify({ at: now(), ...entry }) + "\n");
}

function readCheckpoint(dir, stage) {
  const p = join(dir, "checkpoints", `${stage}.json`);
  return existsSync(p) ? readJson(p) : null;
}

/**
 * A stage is done when it has a checkpoint newer than every earlier stage's.
 * Redoing an earlier stage therefore makes the later ones stale by itself.
 */
export function stageStates(dir, pipeline) {
  let floor = 0;
  let broken = false;
  return pipeline.stages.map((s) => {
    const cp = readCheckpoint(dir, s.name);
    let state = "todo";
    if (cp) state = !broken && cp.seq > floor ? "done" : "stale";
    if (state === "done") floor = cp.seq;
    else broken = true;
    return { stage: s, checkpoint: cp, state };
  });
}

let ajv;
function validator(schemaName) {
  ajv ??= new Ajv({ allErrors: true, strict: false });
  return ajv.compile(readJson(join(SCHEMAS, `${schemaName}.schema.json`)));
}

const GENERIC_PARTS = ["first_screen", "palette", "type", "layout", "imagery"];

function conceptProblems(rel, c, problems) {
  const candidates = c.candidates ?? [];
  const territories = candidates.map((x) => x.territory);
  if (new Set(territories).size < territories.length) {
    problems.push(`${rel}: the three concepts must come from three different territories, got ${territories.join(", ")}`);
  }
  const chosen = candidates.find((x) => x.name === c.chosen);
  if (!chosen) problems.push(`${rel}: concept.chosen "${c.chosen}" is not the name of one of the candidates`);
  else if (chosen.scores?.portability >= 4) {
    problems.push(`${rel}: the chosen concept scores ${chosen.scores.portability} on portability, so it would work for another business: it is a style, not a concept. Find an anchor in this business`);
  }
  const parts = new Set((c.generic_check ?? []).map((g) => g.part));
  for (const p of GENERIC_PARTS) if (!parts.has(p)) problems.push(`${rel}: concept.generic_check has no entry for "${p}"`);
  for (const g of c.generic_check ?? []) {
    if (g.generic && String(g.change ?? "").trim().length < 8) {
      problems.push(`${rel}: concept.generic_check says "${g.part}" is where a generic model would land, and names no change. Change it and write what you changed`);
    }
  }
}

const CHROME_TYPES = new Set(["navbar", "header", "footer"]);

function layoutProblems(rel, plan, problems) {
  for (const page of plan.pages ?? []) {
    let prev = null;
    for (const s of page.sections ?? []) {
      if (CHROME_TYPES.has(s.type)) continue;
      const layout = String(s.layout ?? "").trim().toLowerCase();
      if (prev && layout && layout === prev) {
        problems.push(`${rel}: on page "${page.title}", two sections in a row use the layout "${s.layout}". Neighbours get different layouts`);
      }
      prev = layout;
    }
  }
}

function checkArtifact(dir, pipeline, name, stage, problems, opts = {}) {
  const { def, rel, abs } = artifactPath(dir, pipeline, name, stage);
  if (name === "critique") {
    const r = judgeCritique(dir, pipeline, { belowBar: opts.belowBar });
    problems.push(...r.problems);
    opts.warnings?.push(...r.warnings);
    if (r.summary) opts.critique = r.summary;
    return r.last ? { name, path: r.last.file } : null;
  }
  if (!existsSync(abs)) {
    problems.push(`Missing artifact "${name}": ${rel}`);
    return null;
  }
  let data = null;
  if (rel.endsWith(".json")) {
    try {
      data = readJson(abs);
    } catch (e) {
      problems.push(e.message);
      return null;
    }
  }
  if (def.schema) {
    const validate = validator(def.schema);
    if (!validate(data)) {
      for (const err of validate.errors.slice(0, 8)) problems.push(`${rel}${err.instancePath || ""}: ${err.message}`);
    }
  }
  if (name === "design_direction" && data?.concept) conceptProblems(rel, data.concept, problems);
  if (name === "site_plan" && data) layoutProblems(rel, data, problems);
  if (name === "brief" && Array.isArray(data?.open_questions) && data.open_questions.length > 0) {
    problems.push(`${rel}: ${data.open_questions.length} open question(s) left. Ask the user, or move them to "declined" if they chose not to answer`);
  }
  if (name === "preflight" && data.ok !== true) {
    problems.push(`${rel}: preflight did not pass (${(data.problems ?? []).join("; ") || "see the report"}). Fix it and run "studio preflight <project>" again`);
  }
  if (name === "assets_manifest" && Array.isArray(data?.files)) {
    const assets = join(dir, pipeline.bundle, "assets");
    for (const f of data.files) {
      if (typeof f.file === "string" && !existsSync(join(assets, f.file))) problems.push(`${rel}: "${f.file}" is not in ${pipeline.bundle}/assets/`);
      if (f.origin === "library" && /\b(NC|ND|non-?commercial|no-?deriv)/i.test(f.licence ?? "")) {
        problems.push(`${rel}: "${f.file}" has licence "${f.licence}", which does not allow use on a business's site or changes to the file. Choose another asset`);
      }
    }
    if (data.poster && !data.files.some((f) => f.file === data.poster)) problems.push(`${rel}: the poster "${data.poster}" is not listed in files`);
    // Every generated model must have been taken out of the budget the user approved.
    const generated = data.files.filter((f) => f.kind === "model" && f.origin === "ai-generated").length;
    const reserved = readJson(join(dir, "project.json")).modelBudget?.used ?? 0;
    if (generated > reserved) {
      problems.push(`${rel}: ${generated} generated model(s) listed but ${reserved} reserved. A generation is reserved with "studio model-reserve" before the generator is asked, inside a budget the user approved`);
    }
  }
  if (name === "check_report") {
    if (data.ok !== true) problems.push(`${rel}: the last check did not pass. Fix the errors and run "studio check" again`);
    const bundleDir = join(dir, pipeline.bundle);
    if (def.fresh && data.bundleHash !== hashBundle(bundleDir)) {
      problems.push(`${rel}: the bundle changed after it was checked. Run "studio check" again`);
    }
  }
  if (name === "review") {
    if (data.stage !== stage) problems.push(`${rel}: "stage" must be "${stage}"`);
    const open = (data.findings ?? []).filter((f) => f.severity === "blocker" && !f.fixed);
    if (open.length) problems.push(`${rel}: ${open.length} blocker(s) not fixed`);
    if (data.verdict !== "pass") problems.push(`${rel}: verdict is "${data.verdict}". A stage is checkpointed only on a pass`);
  }
  return { name, path: rel };
}

/**
 * Record that a stage is finished. Refuses when an earlier stage is not done,
 * an artifact is missing or invalid, the self-review did not pass, or a gated
 * stage carries no approval from the user.
 */
export function writeCheckpoint(slug, stageName, { approved, note, belowBar } = {}) {
  const { dir, meta } = loadProject(slug);
  const pipeline = loadPipeline(meta.pipeline);
  const states = stageStates(dir, pipeline);
  const idx = states.findIndex((s) => s.stage.name === stageName);
  if (idx < 0) throw new StudioError(`Pipeline "${pipeline.name}" has no stage "${stageName}". Stages: ${pipeline.stages.map((s) => s.name).join(", ")}`);
  const stage = states[idx].stage;
  const problems = [];

  const pending = states.slice(0, idx).filter((s) => s.state !== "done");
  if (pending.length) problems.push(`Earlier stage(s) not checkpointed: ${pending.map((s) => `${s.stage.name} (${s.state})`).join(", ")}`);

  const opts = { belowBar, warnings: [] };
  for (const name of stage.requires) checkArtifact(dir, pipeline, name, stageName, problems);
  const artifacts = [];
  for (const name of new Set([...stage.produces, ...(stage.review ? ["review"] : [])])) {
    const a = checkArtifact(dir, pipeline, name, stageName, problems, opts);
    if (a) artifacts.push(a);
  }

  const quote = typeof approved === "string" ? approved.trim() : "";
  if (stage.human_approval && quote.length < 2) {
    problems.push(`Stage "${stageName}" needs the user's approval. Show them: ${stage.approval_shows ?? "the result"}. Then pass --approved "<what they said>"`);
  }

  const previous = states[idx].checkpoint;
  const revision = previous ? previous.revision + 1 : 0;
  const max = pipeline.orchestration?.max_revisions_per_stage ?? 3;
  if (revision > max) problems.push(`Stage "${stageName}" was already redone ${max} times. Stop and ask the user how to proceed`);

  if (problems.length) throw new StudioError(`Checkpoint refused for "${stageName}":\n- ${problems.join("\n- ")}`);

  meta.seq += 1;
  writeJson(join(dir, "project.json"), meta);
  const checkpoint = {
    stage: stageName,
    seq: meta.seq,
    revision,
    at: now(),
    approval: stage.human_approval ? { quote, at: now() } : null,
    artifacts,
    ...(opts.critique ? { critique: opts.critique } : {}),
    ...(note ? { note: String(note) } : {}),
  };
  writeJson(join(dir, "checkpoints", `${stageName}.json`), checkpoint);
  logDecision(dir, {
    kind: "checkpoint",
    stage: stageName,
    revision,
    ...(quote ? { approval: quote } : {}),
    ...(opts.critique ? { critique: opts.critique } : {}),
  });
  const next = states[idx + 1]?.stage ?? null;
  return { checkpoint, next, warnings: opts.warnings };
}
