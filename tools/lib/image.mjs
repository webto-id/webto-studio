// Text-to-image through the user's own key, for agents that cannot make
// images themselves. Four providers, one shape: a prompt and an aspect ratio
// in, one image file in the bundle's assets out.
//
// Request and response shapes follow each provider's HTTP reference:
//   gemini      ai.google.dev/gemini-api/docs/image-generation      (generateContent)
//   openrouter  openrouter.ai/docs/features/multimodal/image-generation  (POST /api/v1/images)
//   openai      platform.openai.com/docs/api-reference/images       (POST /v1/images/generations)
//   fal         fal.ai/docs/api-reference/inference-api/sync/run    (POST fal.run/<model>)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StudioError, now, readJson, writeJson } from "./core.mjs";
import { loadPipeline, loadProject, logDecision } from "./pipelines.mjs";

export const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
/** The platform's limit for one bundle image. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const EXT_TYPE = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const TYPE_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const landscape = (a) => ["16:9", "4:3", "3:2"].includes(a);
const portrait = (a) => ["9:16", "3:4", "2:3"].includes(a);

export const PROVIDERS = {
  gemini: {
    label: "Google AI Studio (Gemini)",
    keyEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    modelEnv: "GEMINI_IMAGE_MODEL",
    defaultModel: "gemini-3.1-flash-image",
    request: ({ key, model, prompt, aspect }) => ({
      url: `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
      headers: { "x-goog-api-key": key },
      body: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: aspect } },
      },
    }),
    // Preview models are served from v1beta only.
    retry404: (req) => ({ ...req, url: req.url.replace("/v1/models/", "/v1beta/models/") }),
    parse: (json) => {
      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      const inline = parts.find((p) => p.inlineData?.data)?.inlineData;
      if (inline) return { base64: inline.data, contentType: inline.mimeType ?? "image/png" };
      const why = json?.promptFeedback?.blockReason ?? json?.candidates?.[0]?.finishReason ?? parts.find((p) => p.text)?.text?.slice(0, 200);
      throw new StudioError(`Gemini returned no image${why ? ` (${why})` : ""}. Check that the model is an image model.`);
    },
  },
  openrouter: {
    label: "OpenRouter",
    keyEnv: ["OPENROUTER_API_KEY"],
    modelEnv: "OPENROUTER_IMAGE_MODEL",
    defaultModel: "google/gemini-2.5-flash-image",
    request: ({ key, model, prompt, aspect }) => ({
      url: "https://openrouter.ai/api/v1/images",
      headers: { Authorization: `Bearer ${key}` },
      body: { model, prompt, aspect_ratio: aspect },
    }),
    parse: (json) => {
      const d = json?.data?.[0];
      if (d?.b64_json) return { base64: d.b64_json, contentType: d.media_type ?? "image/png" };
      throw new StudioError("OpenRouter returned no image. Check that the model is listed at https://openrouter.ai/api/v1/images/models");
    },
  },
  openai: {
    label: "OpenAI",
    keyEnv: ["OPENAI_API_KEY"],
    modelEnv: "OPENAI_IMAGE_MODEL",
    defaultModel: "gpt-image-2",
    request: ({ key, model, prompt, aspect }) => ({
      url: "https://api.openai.com/v1/images/generations",
      headers: { Authorization: `Bearer ${key}` },
      body: { model, prompt, size: landscape(aspect) ? "1536x1024" : portrait(aspect) ? "1024x1536" : "1024x1024", output_format: "jpeg" },
    }),
    parse: (json) => {
      const d = json?.data?.[0];
      if (d?.b64_json) return { base64: d.b64_json, contentType: "image/jpeg" };
      throw new StudioError("OpenAI returned no image.");
    },
  },
  fal: {
    label: "fal.ai",
    keyEnv: ["FAL_KEY"],
    modelEnv: "FAL_IMAGE_MODEL",
    defaultModel: "fal-ai/flux/schnell",
    request: ({ key, model, prompt, aspect }) => ({
      url: `https://fal.run/${model.split("/").map(encodeURIComponent).join("/")}`,
      headers: { Authorization: `Key ${key}` },
      body: {
        prompt,
        image_size: { "1:1": "square_hd", "16:9": "landscape_16_9", "9:16": "portrait_16_9", "4:3": "landscape_4_3", "3:2": "landscape_4_3", "3:4": "portrait_4_3", "2:3": "portrait_4_3" }[aspect],
        num_images: 1,
        output_format: "jpeg",
      },
    }),
    parse: (json) => {
      const img = json?.images?.[0];
      if (img?.url) return { url: img.url, contentType: img.content_type ?? "image/jpeg" };
      throw new StudioError("fal returned no image. Models other than the FLUX family may take other input fields.");
    },
  },
};

const keyOf = (p, env) => p.keyEnv.map((k) => env[k]?.trim()).find(Boolean);

/** Which providers have a key, and which one a call would use. */
export function imageSetup(env = process.env) {
  const configured = Object.entries(PROVIDERS)
    .filter(([, p]) => keyOf(p, env))
    .map(([name, p]) => ({ provider: name, label: p.label, model: env[p.modelEnv]?.trim() || p.defaultModel }));
  const wanted = env.IMAGE_PROVIDER?.trim().toLowerCase();
  const chosen = wanted ? configured.find((c) => c.provider === wanted) ?? null : configured[0] ?? null;
  return { configured, default: chosen, ...(wanted && !chosen ? { problem: `IMAGE_PROVIDER is "${wanted}" but that provider has no key set` } : {}) };
}

function errorText(json, text) {
  const e = json?.error?.message ?? json?.error ?? json?.detail ?? json?.message ?? text?.slice(0, 200);
  return typeof e === "string" ? e : JSON.stringify(e).slice(0, 300);
}

/** One call to one provider. Returns the image bytes and their type. */
export async function callProvider(name, { key, model, prompt, aspect }, fetchImpl = fetch) {
  const provider = PROVIDERS[name];
  let req = provider.request({ key, model, prompt, aspect });
  const send = (r) => fetchImpl(r.url, { method: "POST", headers: { "Content-Type": "application/json", ...r.headers }, body: JSON.stringify(r.body), signal: AbortSignal.timeout(180_000) });
  let res = await send(req);
  if (res.status === 404 && provider.retry404) {
    req = provider.retry404(req);
    res = await send(req);
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok) throw new StudioError(`${provider.label} refused the request (HTTP ${res.status}): ${errorText(json, text)}`);
  const out = provider.parse(json);
  if (out.base64) return { bytes: Buffer.from(out.base64, "base64"), contentType: out.contentType };
  const file = await fetchImpl(out.url, { signal: AbortSignal.timeout(60_000) });
  if (!file.ok) throw new StudioError(`${provider.label} made the image but it could not be downloaded (HTTP ${file.status})`);
  return { bytes: Buffer.from(await file.arrayBuffer()), contentType: file.headers.get("content-type")?.split(";")[0] || out.contentType };
}

/**
 * Bring the image to the file type the name asks for and under the
 * platform's size limit. With `sharp` installed this always works; without
 * it the bytes are kept as the provider sent them.
 */
export async function fitImage({ bytes, contentType }, ext, sharpImpl) {
  let sharp = sharpImpl;
  if (sharp === undefined) {
    try {
      sharp = (await import("sharp")).default;
    } catch {
      sharp = null;
    }
  }
  if (!sharp) return { bytes, ext: TYPE_EXT[contentType] ?? ext, converted: false };
  const target = ext === "jpeg" ? "jpg" : ext;
  for (const [width, quality] of [[2400, 86], [2000, 80], [1600, 76], [1280, 72]]) {
    const img = sharp(bytes).rotate().resize({ width, withoutEnlargement: true });
    const out = await (target === "png" ? img.png({ compressionLevel: 9, palette: quality < 80 }) : target === "webp" ? img.webp({ quality }) : img.jpeg({ quality, mozjpeg: true })).toBuffer();
    if (out.length <= MAX_IMAGE_BYTES || width === 1280) return { bytes: out, ext: target, converted: true };
  }
}

export function setImageBudget(slug, { max, approved }) {
  const { dir, meta } = loadProject(slug);
  const n = Number(max);
  if (!Number.isInteger(n) || n < 1 || n > 60) throw new StudioError("--max is the number of images the user agreed to, from 1 to 60");
  const quote = typeof approved === "string" ? approved.trim() : "";
  if (quote.length < 2) throw new StudioError('Generating images spends the user\'s own credit. Tell them the provider, the model and how many images, then pass --approved "<what they said>"');
  meta.imageBudget = { max: n, used: meta.imageBudget?.used ?? 0, approval: quote, at: now() };
  writeJson(join(dir, "project.json"), meta);
  logDecision(dir, { kind: "image-budget", max: n, approval: quote });
  return meta.imageBudget;
}

export async function generateImage(slug, { prompt, out, aspect = "16:9", provider, model, dryRun = false }, { env = process.env, fetchImpl = fetch } = {}) {
  const { dir, meta } = loadProject(slug);
  const pipeline = loadPipeline(meta.pipeline);
  if (typeof prompt !== "string" || prompt.trim().length < 10) throw new StudioError('Pass --prompt "<what the image shows>" (at least a sentence)');
  if (!ASPECTS.includes(aspect)) throw new StudioError(`--aspect must be one of ${ASPECTS.join(", ")}`);
  const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)\.(jpe?g|png|webp)$/.exec(typeof out === "string" ? out : "");
  if (!m) throw new StudioError("--out is a file name such as hero-kitchen.jpg (letters, digits, dots, hyphens, underscores; jpg, png or webp)");

  const setup = imageSetup(provider ? { ...env, IMAGE_PROVIDER: provider } : env);
  if (!setup.default) {
    throw new StudioError(
      `${setup.problem ?? "No image provider is configured"}. Add one key to .env (see .env.example): ${Object.values(PROVIDERS).map((p) => p.keyEnv[0]).join(", ")}. Without one, use the user's own images or stock stand-ins (__IMG__:<query>).`,
    );
  }
  const name = setup.default.provider;
  const useModel = (typeof model === "string" && model.trim()) || setup.default.model;
  const plan = { provider: name, label: setup.default.label, model: useModel, aspect, budget: meta.imageBudget ?? null };
  if (dryRun) return { dryRun: true, ...plan };

  const budget = meta.imageBudget;
  if (!budget) throw new StudioError(`No image budget for this project yet. Tell the user it will use ${plan.label} (${useModel}) on their key and how many images you plan, then: node tools/studio.mjs image-budget ${slug} --max <n> --approved "<what they said>"`);
  if (budget.used >= budget.max) throw new StudioError(`The image budget is used up (${budget.used} of ${budget.max}). Ask the user before raising it with image-budget.`);

  // Counted before the call: a request that fails after it was sent may still be billed.
  budget.used += 1;
  writeJson(join(dir, "project.json"), meta);
  const raw = await callProvider(name, { key: keyOf(PROVIDERS[name], env), model: useModel, prompt: prompt.trim(), aspect }, fetchImpl);
  const fitted = await fitImage(raw, m[2].toLowerCase());
  const file = `${m[1]}.${fitted.ext}`;
  const assets = join(dir, pipeline.bundle, "assets");
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(assets, file), fitted.bytes);

  const recordPath = join(dir, "generated_images.json");
  const record = existsSync(recordPath) ? readJson(recordPath) : { images: [] };
  record.images = record.images.filter((i) => i.file !== file);
  record.images.push({ file, provider: name, model: useModel, aspect, prompt: prompt.trim(), bytes: fitted.bytes.length, at: now() });
  writeJson(recordPath, record);

  const notes = [];
  if (file !== out) notes.push(`Saved as ${file}: the provider sent ${raw.contentType} and it could not be converted (install sharp: npm install sharp).`);
  if (fitted.bytes.length > MAX_IMAGE_BYTES) notes.push(`The file is ${(fitted.bytes.length / 1048576).toFixed(1)} MB, above the platform's 2 MB limit for a bundle image. Install sharp (npm install sharp) and generate again, or the upload will be refused.`);
  return { ...plan, file, ref: `asset:${file}`, path: `${pipeline.bundle}/assets/${file}`, bytes: fitted.bytes.length, used: budget.used, max: budget.max, notes };
}
