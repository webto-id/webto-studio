// 3D models: a budget for paid generation, and an inspector that reads a
// .glb the way the platform's runtime will meet it.
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { StudioError, now, writeJson } from "./core.mjs";
import { loadPipeline, loadProject, logDecision } from "./pipelines.mjs";

/** The platform's upload limit for one model, and the size that loads well on a phone. */
export const MAX_MODEL_BYTES = 10 * 1024 * 1024;
const GOOD_MODEL_BYTES = 3 * 1024 * 1024;

export function setModelBudget(slug, { max, approved }) {
  const { dir, meta } = loadProject(slug);
  const n = Number(max);
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new StudioError("--max is the number of generated models the user agreed to, from 1 to 10");
  const quote = typeof approved === "string" ? approved.trim() : "";
  if (quote.length < 2) throw new StudioError('Generating a 3D model may spend the user\'s credit with the generator. Tell them which generator and how many attempts, then pass --approved "<what they said>"');
  meta.modelBudget = { max: n, used: meta.modelBudget?.used ?? 0, approval: quote, at: now() };
  writeJson(join(dir, "project.json"), meta);
  logDecision(dir, { kind: "model-budget", max: n, approval: quote });
  return meta.modelBudget;
}

/** Take one generation out of the budget. Called BEFORE the generator is asked. */
export function reserveModel(slug, { what }) {
  const { dir, meta } = loadProject(slug);
  const text = typeof what === "string" ? what.trim() : "";
  if (text.length < 5) throw new StudioError('Pass --what "<the object to generate>"');
  const b = meta.modelBudget;
  if (!b) throw new StudioError(`No model budget for this project yet. Tell the user which generator it will use and how many attempts you plan, then: node tools/studio.mjs model-budget ${slug} --max <n> --approved "<what they said>"`);
  if (b.used >= b.max) throw new StudioError(`The model budget is used up (${b.used} of ${b.max}). Ask the user before raising it with model-budget.`);
  b.used += 1;
  writeJson(join(dir, "project.json"), meta);
  logDecision(dir, { kind: "model-reserve", what: text, used: b.used, max: b.max });
  return b;
}

/** Pure: the facts of one .glb, and what will stop it from loading. */
export async function inspectGlb(bytes, sharpImpl) {
  const problems = [];
  const advice = [];
  const info = { bytes: bytes.length };
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67) {
    return { ...info, problems: ["Not a .glb file (a .gltf with separate files does not load: convert it with `npx @gltf-transform/cli copy model.gltf model.glb`)"], advice };
  }
  info.version = bytes.readUInt32LE(4);
  if (info.version !== 2) problems.push(`glTF version ${info.version}; the platform loads version 2`);
  const jsonLen = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a || 20 + jsonLen > bytes.length) return { ...info, problems: [...problems, "The file's JSON chunk is damaged"], advice };
  let gltf;
  try {
    gltf = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString("utf8"));
  } catch {
    return { ...info, problems: [...problems, "The file's JSON chunk cannot be read"], advice };
  }
  const binStart = 20 + jsonLen + 8;
  const bin = binStart <= bytes.length ? bytes.subarray(binStart) : null;

  const acc = (i) => gltf.accessors?.[i]?.count ?? 0;
  let triangles = 0;
  let vertices = 0;
  let primitives = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const p of mesh.primitives ?? []) {
      primitives++;
      vertices += acc(p.attributes?.POSITION);
      if ((p.mode ?? 4) === 4) triangles += Math.floor((p.indices !== undefined ? acc(p.indices) : acc(p.attributes?.POSITION)) / 3);
    }
  }
  const ext = gltf.extensionsUsed ?? [];
  Object.assign(info, {
    meshes: gltf.meshes?.length ?? 0,
    primitives,
    vertices,
    triangles,
    materials: gltf.materials?.length ?? 0,
    animations: gltf.animations?.length ?? 0,
    extensions: ext,
    compression: ext.includes("KHR_draco_mesh_compression") ? "draco" : ext.includes("EXT_meshopt_compression") ? "meshopt" : "none",
    textures: [],
  });

  if (!info.meshes) problems.push("The file holds no mesh");
  if (bytes.length > MAX_MODEL_BYTES) problems.push(`${(bytes.length / 1048576).toFixed(1)} MB: above the platform's 10 MB limit for a model`);
  if (ext.includes("KHR_texture_basisu")) problems.push("KTX2 / Basis textures (KHR_texture_basisu): the platform has no decoder for them, the model will not load. Re-export with WebP, JPEG or PNG textures");
  for (const [i, b] of (gltf.buffers ?? []).entries()) if (b.uri && !b.uri.startsWith("data:")) problems.push(`Buffer ${i} is a separate file (${b.uri}): everything must be inside the .glb`);

  let sharp = sharpImpl;
  if (sharp === undefined) {
    try {
      sharp = (await import("sharp")).default;
    } catch {
      sharp = null;
    }
  }
  for (const [i, img] of (gltf.images ?? []).entries()) {
    if (img.uri && !img.uri.startsWith("data:")) {
      problems.push(`Image ${i} is a separate file (${img.uri}): textures must be embedded in the .glb`);
      continue;
    }
    const t = { index: i, type: img.mimeType ?? "unknown" };
    const view = gltf.bufferViews?.[img.bufferView];
    if (view && bin) {
      t.bytes = view.byteLength;
      if (sharp) {
        try {
          const m = await sharp(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)).metadata();
          t.width = m.width;
          t.height = m.height;
        } catch {}
      }
    }
    info.textures.push(t);
  }

  if (bytes.length > GOOD_MODEL_BYTES && bytes.length <= MAX_MODEL_BYTES) advice.push(`${(bytes.length / 1048576).toFixed(1)} MB uploads, but 1 to 3 MB is what loads well on a phone`);
  if (info.compression === "none" && triangles > 20_000) advice.push("The mesh is not compressed: export with Draco, or run `npx @gltf-transform/cli optimize in.glb out.glb --compress draco --texture-compress webp`");
  if (triangles > 300_000) advice.push(`${triangles.toLocaleString("en")} triangles is heavy for a phone: decimate the mesh in Blender`);
  const big = info.textures.filter((t) => Math.max(t.width ?? 0, t.height ?? 0) > 2048);
  if (big.length) advice.push(`${big.length} texture(s) larger than 2048 px: \`npx @gltf-transform/cli resize in.glb out.glb --width 1024 --height 1024\``);
  return { ...info, problems, advice };
}

export async function inspectProjectGlb(slug, file) {
  const { dir, meta } = loadProject(slug);
  const pipeline = loadPipeline(meta.pipeline);
  if (typeof file !== "string" || !file) throw new StudioError("Usage: glb <project> <file.glb>");
  const path = isAbsolute(file) || existsSync(file) ? file : join(dir, pipeline.bundle, "assets", file);
  if (!existsSync(path) || !statSync(path).isFile()) throw new StudioError(`No such file: ${file} (looked in ${pipeline.bundle}/assets/ too)`);
  const report = { file: basename(path), at: now(), ...(await inspectGlb(readFileSync(path))) };
  report.ok = report.problems.length === 0;
  writeJson(join(dir, "reports", `glb-${basename(path).replace(/[^A-Za-z0-9._-]/g, "_")}.json`), report);
  return report;
}
