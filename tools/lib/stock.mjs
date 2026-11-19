// Stock photographs chosen by the agent, through the user's own free API key.
// Search first, look at the candidates, then take one into the bundle.
//
// The three libraries ask for different handling, and this file follows each:
//   Unsplash  photos must be shown from Unsplash's own URLs (hotlinked), a
//             download event is sent when one is used, and the photographer
//             and Unsplash are credited.          unsplash.com/documentation
//   Pexels    photos are downloaded; a credit to the photographer and Pexels
//             is asked for.                 pexels.com/api/documentation
//   Pixabay   permanent hotlinking is not allowed: photos are downloaded to
//             the site's own storage.               pixabay.com/api/docs
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StudioError, now, readJson, writeJson } from "./core.mjs";
import { MAX_IMAGE_BYTES, fitImage } from "./image.mjs";
import { loadPipeline, loadProject } from "./pipelines.mjs";

export const ORIENTATIONS = ["landscape", "portrait", "square"];
const UTM = "utm_source=webto-studio&utm_medium=referral";
const withUtm = (url) => (url ? `${url}${url.includes("?") ? "&" : "?"}${UTM}` : url);

export const STOCK = {
  unsplash: {
    label: "Unsplash",
    keyEnv: ["UNSPLASH_ACCESS_KEY"],
    delivery: "hotlink",
    headers: (key) => ({ Authorization: `Client-ID ${key}`, "Accept-Version": "v1" }),
    searchUrl: ({ query, orientation, count }) => {
      const u = new URL("https://api.unsplash.com/search/photos");
      u.searchParams.set("query", query);
      u.searchParams.set("per_page", String(Math.min(count, 30)));
      if (orientation) u.searchParams.set("orientation", orientation === "square" ? "squarish" : orientation);
      return u.href;
    },
    parse: (json) =>
      (json?.results ?? []).map((p) => ({
        id: String(p.id),
        width: p.width,
        height: p.height,
        description: p.alt_description ?? p.description ?? "",
        photographer: p.user?.name ?? "",
        photographerUrl: withUtm(p.user?.links?.html),
        pageUrl: withUtm(p.links?.html),
        preview: p.urls?.small,
        full: p.urls?.raw,
        downloadLocation: p.links?.download_location,
      })),
  },
  pexels: {
    label: "Pexels",
    keyEnv: ["PEXELS_API_KEY"],
    delivery: "download",
    headers: (key) => ({ Authorization: key }),
    searchUrl: ({ query, orientation, count }) => {
      const u = new URL("https://api.pexels.com/v1/search");
      u.searchParams.set("query", query);
      u.searchParams.set("per_page", String(Math.min(count, 80)));
      if (orientation) u.searchParams.set("orientation", orientation);
      return u.href;
    },
    parse: (json) =>
      (json?.photos ?? []).map((p) => ({
        id: String(p.id),
        width: p.width,
        height: p.height,
        description: p.alt ?? "",
        photographer: p.photographer ?? "",
        photographerUrl: p.photographer_url,
        pageUrl: p.url,
        preview: p.src?.medium,
        full: p.src?.large2x ?? p.src?.original,
      })),
  },
  pixabay: {
    label: "Pixabay",
    keyEnv: ["PIXABAY_API_KEY"],
    delivery: "download",
    headers: () => ({}),
    searchUrl: ({ key, query, orientation, count }) => {
      const u = new URL("https://pixabay.com/api/");
      u.searchParams.set("key", key);
      u.searchParams.set("q", query.slice(0, 100));
      u.searchParams.set("image_type", "photo");
      u.searchParams.set("safesearch", "true");
      u.searchParams.set("per_page", String(Math.min(Math.max(count, 3), 200)));
      if (orientation && orientation !== "square") u.searchParams.set("orientation", orientation === "landscape" ? "horizontal" : "vertical");
      return u.href;
    },
    parse: (json) =>
      (json?.hits ?? []).map((p) => ({
        id: String(p.id),
        width: p.imageWidth,
        height: p.imageHeight,
        description: p.tags ?? "",
        photographer: p.user ?? "",
        photographerUrl: p.user && p.user_id ? `https://pixabay.com/users/${encodeURIComponent(p.user)}-${p.user_id}/` : undefined,
        pageUrl: p.pageURL,
        preview: p.webformatURL,
        full: p.largeImageURL,
      })),
  },
};

const keyOf = (p, env) => p.keyEnv.map((k) => env[k]?.trim()).find(Boolean);

export function stockSetup(env = process.env) {
  const configured = Object.entries(STOCK)
    .filter(([, p]) => keyOf(p, env))
    .map(([name, p]) => ({ provider: name, label: p.label }));
  const wanted = env.STOCK_PROVIDER?.trim().toLowerCase();
  const chosen = wanted ? configured.find((c) => c.provider === wanted) ?? null : configured[0] ?? null;
  return { configured, default: chosen, ...(wanted && !chosen ? { problem: `STOCK_PROVIDER is "${wanted}" but that library has no key set` } : {}) };
}

export const creditLine = (provider, photographer) => `Photo by ${photographer || "an unnamed photographer"} on ${STOCK[provider].label}`;

async function getJson(label, url, headers, fetchImpl) {
  const res = await fetchImpl(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    const why = json?.errors?.join?.("; ") ?? json?.error ?? text.slice(0, 160);
    throw new StudioError(`${label} refused the search (HTTP ${res.status}): ${typeof why === "string" ? why : JSON.stringify(why)}${res.status === 429 || res.status === 403 ? ". The free key has an hourly limit; wait, or use another library." : ""}`);
  }
  return json;
}

/** Search one library and keep the candidates, with a small preview of each to look at. */
export async function searchStock(slug, { query, orientation, provider, count = 6 }, { env = process.env, fetchImpl = fetch } = {}) {
  const { dir } = loadProject(slug);
  if (typeof query !== "string" || query.trim().length < 3) throw new StudioError('Pass --query "<what the photo shows, in English>"');
  if (orientation !== undefined && !ORIENTATIONS.includes(orientation)) throw new StudioError(`--orientation must be one of ${ORIENTATIONS.join(", ")}`);
  const n = Math.min(Math.max(Number(count) || 6, 1), 12);
  const setup = stockSetup(provider ? { ...env, STOCK_PROVIDER: provider } : env);
  if (!setup.default) {
    throw new StudioError(
      `${setup.problem ?? "No stock library is configured"}. Add a free key to .env (see .env.example): ${Object.values(STOCK).map((p) => p.keyEnv[0]).join(", ")}. Without one, write __IMG__:<query> and the platform picks a photo itself.`,
    );
  }
  const name = setup.default.provider;
  const lib = STOCK[name];
  const key = keyOf(lib, env);
  const json = await getJson(lib.label, lib.searchUrl({ key, query: query.trim(), orientation, count: n }), lib.headers(key), fetchImpl);
  const results = lib.parse(json).filter((r) => r.full).slice(0, n).map((r, i) => ({ pick: i + 1, provider: name, ...r }));

  const previewDir = join(dir, "reports", "stock");
  rmSync(previewDir, { recursive: true, force: true });
  mkdirSync(previewDir, { recursive: true });
  await Promise.all(
    results.map(async (r) => {
      try {
        const res = await fetchImpl(r.preview, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) return;
        r.previewFile = `reports/stock/${r.pick}.jpg`;
        writeFileSync(join(previewDir, `${r.pick}.jpg`), Buffer.from(await res.arrayBuffer()));
      } catch {}
    }),
  );
  writeJson(join(dir, "reports", "stock-search.json"), { at: now(), query: query.trim(), orientation: orientation ?? null, provider: name, results });
  return { provider: name, label: lib.label, delivery: lib.delivery, results };
}

/** Take one candidate of the last search into the site, the way its library requires. */
export async function useStock(slug, { pick, out }, { env = process.env, fetchImpl = fetch } = {}) {
  const { dir, meta } = loadProject(slug);
  const pipeline = loadPipeline(meta.pipeline);
  const searchPath = join(dir, "reports", "stock-search.json");
  if (!existsSync(searchPath)) throw new StudioError("Search first: node tools/studio.mjs stock <project> --query \"...\"");
  const search = readJson(searchPath);
  const r = search.results.find((x) => x.pick === Number(pick));
  if (!r) throw new StudioError(`--pick is a number from 1 to ${search.results.length}, from the last search ("${search.query}")`);
  const lib = STOCK[r.provider];
  const key = keyOf(lib, env);
  if (!key) throw new StudioError(`${lib.keyEnv[0]} is no longer set`);
  const base = { provider: r.provider, id: r.id, photographer: r.photographer, photographerUrl: r.photographerUrl ?? null, pageUrl: r.pageUrl ?? null, credit: creditLine(r.provider, r.photographer), query: search.query, at: now() };
  let entry;

  if (lib.delivery === "hotlink") {
    // Unsplash counts a use through this endpoint; the image itself stays on their URL.
    if (r.downloadLocation) await fetchImpl(r.downloadLocation, { headers: lib.headers(key), signal: AbortSignal.timeout(30_000) }).catch(() => {});
    const ref = `${r.full}${r.full.includes("?") ? "&" : "?"}w=1920&q=80&auto=format&fit=max`;
    entry = { ...base, ref, file: null, creditRule: "required" };
  } else {
    const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)\.(jpe?g|png|webp)$/.exec(typeof out === "string" ? out : "");
    if (!m) throw new StudioError(`${lib.label} photos are downloaded into the bundle: pass --out <name>.jpg (letters, digits, dots, hyphens, underscores)`);
    const res = await fetchImpl(r.full, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new StudioError(`The photo could not be downloaded from ${lib.label} (HTTP ${res.status}). Search again: its links expire.`);
    const raw = { bytes: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type")?.split(";")[0] || "image/jpeg" };
    const fitted = await fitImage(raw, m[2].toLowerCase());
    const file = `${m[1]}.${fitted.ext}`;
    const assets = join(dir, pipeline.bundle, "assets");
    mkdirSync(assets, { recursive: true });
    writeFileSync(join(assets, file), fitted.bytes);
    entry = { ...base, ref: `asset:${file}`, file, bytes: fitted.bytes.length, creditRule: r.provider === "pexels" ? "asked" : "none", ...(fitted.bytes.length > MAX_IMAGE_BYTES ? { oversize: true } : {}) };
  }

  const recordPath = join(dir, "stock_images.json");
  const record = existsSync(recordPath) ? readJson(recordPath) : { images: [] };
  record.images = record.images.filter((i) => i.ref !== entry.ref);
  record.images.push(entry);
  writeJson(recordPath, record);
  return { ...entry, label: lib.label, delivery: lib.delivery, path: entry.file ? `${pipeline.bundle}/assets/${entry.file}` : null };
}
