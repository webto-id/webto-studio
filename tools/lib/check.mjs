// Runs the platform's own compiler over a project's bundle and records the result.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { StudioError, hashBundle, loadConfig, now, writeJson } from "./core.mjs";
import { loadPipeline, loadProject } from "./pipelines.mjs";

export function checkBundle(slug, { strict } = {}) {
  const { dir, meta } = loadProject(slug);
  const pipeline = loadPipeline(meta.pipeline);
  const bundleDir = join(dir, pipeline.bundle);
  const manifest = join(bundleDir, `${pipeline.bundle}.json`);
  if (!existsSync(manifest)) throw new StudioError(`Nothing to check yet: ${pipeline.bundle}/${pipeline.bundle}.json does not exist in project "${slug}"`);

  // A template is merchandise and is compiled strict by the marketplace.
  const useStrict = strict ?? pipeline.bundle === "template";
  const pkg = loadConfig().agent.validatorPackage;
  const command = `npx --yes ${pkg} site "${bundleDir}"${useStrict ? " --strict" : ""}`;
  const run = spawnSync(command, { shell: true, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (run.error) throw new StudioError(`Could not run the validator: ${run.error.message}`);
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
  const report = {
    at: now(),
    ok: run.status === 0,
    exitCode: run.status,
    strict: useStrict,
    command: `npx ${pkg} site ${pipeline.bundle}${useStrict ? " --strict" : ""}`,
    bundleHash: hashBundle(bundleDir),
    output: output.split("\n").slice(-200).join("\n"),
  };
  writeJson(join(dir, "reports", "check.json"), report);
  return report;
}
