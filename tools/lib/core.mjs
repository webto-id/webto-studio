// Shared helpers: paths, config, JSON, hashing, argument parsing.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A failure the user can act on: printed without a stack trace. */
export class StudioError extends Error {}

export function projectsDir() {
  return process.env.STUDIO_PROJECTS_DIR ? resolve(process.env.STUDIO_PROJECTS_DIR) : join(ROOT, "projects");
}

export function loadConfig() {
  const cfg = readJson(join(ROOT, "platform.config.json"));
  const mcpUrl = process.env.WEBTO_MCP_URL?.trim();
  if (mcpUrl) cfg.platform.mcpUrl = mcpUrl;
  return cfg;
}

export function readJson(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new StudioError(`Missing file: ${relative(ROOT, path)}`);
  }
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (e) {
    throw new StudioError(`${relative(ROOT, path)} is not valid JSON: ${e.message}`);
  }
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/**
 * One hash for a bundle folder as it is on disk. The lock file and local
 * previews are left out: they change without the bundle changing.
 */
export function hashBundle(dir) {
  const h = createHash("sha256");
  for (const file of walk(dir)) {
    const rel = relative(dir, file).split("\\").join("/");
    if (rel === "webto.lock.json" || /(^|\/)preview[^/]*\.html$/.test(rel)) continue;
    h.update(rel).update("\0").update(readFileSync(file)).update("\0");
  }
  return h.digest("hex");
}

/** `--flag value`, `--flag` (true) and repeated flags (array). */
export function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    const value = next === undefined || next.startsWith("--") ? true : (i++, next);
    if (key in out.flags) out.flags[key] = [].concat(out.flags[key], value);
    else out.flags[key] = value;
  }
  return out;
}

export const list = (v) => (v === undefined || v === true ? [] : [].concat(v));

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function now() {
  return new Date().toISOString();
}
