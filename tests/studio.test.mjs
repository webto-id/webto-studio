// The rules that keep an agent on the pipeline: order, artifacts, review, approval.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, test } from "node:test";

process.env.STUDIO_PROJECTS_DIR = mkdtempSync(join(tmpdir(), "studio-test-"));
const { hashBundle, writeJson } = await import("../tools/lib/core.mjs");
const { createProject, listPipelines, loadArtifacts, loadPipeline, stageStates, writeCheckpoint } = await import("../tools/lib/pipelines.mjs");
const { decodeEntities, extractPage, parseRobots } = await import("../tools/lib/crawl.mjs");

let n = 0;
let slug;
let dir;
beforeEach(() => {
  slug = `t${++n}`;
  ({ dir } = createProject(slug, "client-site"));
});

const brief = (extra = {}) => ({
  business: { name: "Warung Senja", kind: "warung" },
  language: "id",
  goal: "Pesan lewat WhatsApp",
  facts: [{ field: "address", value: "Jl. Contoh 1", source: "user" }],
  open_questions: [],
  ...extra,
});
const plan = () => ({
  pages: [{ title: "Beranda", slug: "", sections: [{ type: "hero", variant: "hero-warung", purpose: "Say what the place is" }] }],
  variants: [{ key: "hero-warung", sectionType: "hero" }],
  limits: { checked_at: "2026-11-19T00:00:00Z", fits: true },
});
const direction = () => ({
  language: "Warm paper tones, hand-set headings, photos tilted a few degrees like snapshots on a counter.",
  palette: { primary: "#b45309", background: "#fffbeb", foreground: "#1c1917" },
  fonts: { heading: "Fraunces", body: "Inter" },
  moves: ["Headings in a serif with tight leading", "Photos tilted two degrees with a soft shadow"],
  avoid: ["A corporate blue gradient hero"],
});
const review = (stage, extra = {}) => ({ stage, looked_at: ["preview-hero-warung.html"], findings: [], checks_not_done: [], verdict: "pass", ...extra });

function throughPlan() {
  writeJson(join(dir, "reports", "preflight.json"), { ok: true });
  writeCheckpoint(slug, "preflight");
  writeJson(join(dir, "brief.json"), brief());
  writeCheckpoint(slug, "brief");
  writeJson(join(dir, "site_plan.json"), plan());
  writeJson(join(dir, "design_direction.json"), direction());
  writeCheckpoint(slug, "plan", { approved: "ya, lanjut" });
}
function writeBundle(body = "<section>a</section>") {
  mkdirSync(join(dir, "site", "sections"), { recursive: true });
  writeFileSync(join(dir, "site", "site.json"), "{}");
  writeFileSync(join(dir, "site", "sections", "hero-warung.astro"), body);
  writeJson(join(dir, "reports", "check.json"), { ok: true, bundleHash: hashBundle(join(dir, "site")) });
}

test("every pipeline names known artifacts, existing directors and a schema that exists", async () => {
  const { existsSync } = await import("node:fs");
  const { ROOT } = await import("../tools/lib/core.mjs");
  const artifacts = loadArtifacts();
  const pipelines = listPipelines();
  assert.equal(pipelines.length, 4);
  for (const p of pipelines) {
    const produced = new Set();
    for (const s of p.stages) {
      for (const skill of [s.skill, ...(s.extra_skills ?? [])]) assert.ok(existsSync(join(ROOT, "skills", `${skill}.md`)), `${p.name}/${s.name}: skills/${skill}.md`);
      for (const a of [...s.requires, ...s.produces]) assert.ok(artifacts[a], `${p.name}/${s.name}: artifact ${a}`);
      for (const a of s.requires) assert.ok(produced.has(a), `${p.name}/${s.name} requires "${a}" before any stage produces it`);
      for (const a of s.produces) produced.add(a);
      if (s.human_approval) assert.ok(s.approval_shows, `${p.name}/${s.name}: approval_shows`);
      assert.ok(s.success_criteria?.length, `${p.name}/${s.name}: success_criteria`);
    }
  }
  for (const a of Object.values(artifacts)) if (a.schema) assert.ok(existsSync(join(ROOT, "schemas", `${a.schema}.schema.json`)), a.schema);
});

test("a stage cannot be checkpointed before the ones in front of it", () => {
  writeJson(join(dir, "brief.json"), brief());
  assert.throws(() => writeCheckpoint(slug, "brief"), /Earlier stage\(s\) not checkpointed: preflight/);
});

test("a preflight that did not pass cannot be checkpointed", () => {
  writeJson(join(dir, "reports", "preflight.json"), { ok: false, problems: ["WEBTO_TOKEN is not set"] });
  assert.throws(() => writeCheckpoint(slug, "preflight"), /preflight did not pass \(WEBTO_TOKEN is not set\)/);
});

test("a missing or invalid artifact is refused", () => {
  writeJson(join(dir, "reports", "preflight.json"), { ok: true });
  writeCheckpoint(slug, "preflight");
  assert.throws(() => writeCheckpoint(slug, "brief"), /Missing artifact "brief"/);
  writeJson(join(dir, "brief.json"), brief({ facts: [{ field: "price", value: "Rp 10.000", source: "invented" }] }));
  assert.throws(() => writeCheckpoint(slug, "brief"), /brief\.json\/facts\/0\/source/);
});

test("a brief with open questions is not finished", () => {
  writeJson(join(dir, "reports", "preflight.json"), { ok: true });
  writeCheckpoint(slug, "preflight");
  writeJson(join(dir, "brief.json"), brief({ open_questions: ["Jam buka?"] }));
  assert.throws(() => writeCheckpoint(slug, "brief"), /1 open question/);
});

test("a gated stage needs what the user said", () => {
  writeJson(join(dir, "reports", "preflight.json"), { ok: true });
  writeCheckpoint(slug, "preflight");
  writeJson(join(dir, "brief.json"), brief());
  writeCheckpoint(slug, "brief");
  writeJson(join(dir, "site_plan.json"), plan());
  writeJson(join(dir, "design_direction.json"), direction());
  assert.throws(() => writeCheckpoint(slug, "plan"), /needs the user's approval/);
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: true }), /needs the user's approval/);
  const { checkpoint, next } = writeCheckpoint(slug, "plan", { approved: "oke, sesuai" });
  assert.equal(checkpoint.approval.quote, "oke, sesuai");
  assert.equal(next.name, "build");
});

test("build needs a passing check of the bundle as it is on disk, and a passing review", () => {
  throughPlan();
  writeBundle();
  assert.throws(() => writeCheckpoint(slug, "build"), /Missing artifact "review"/);
  writeJson(join(dir, "review", "build.json"), review("build", { findings: [{ severity: "blocker", where: "hero", what: "text unreadable", fixed: false }] }));
  assert.throws(() => writeCheckpoint(slug, "build"), /1 blocker\(s\) not fixed/);
  writeJson(join(dir, "review", "build.json"), review("build", { verdict: "fail" }));
  assert.throws(() => writeCheckpoint(slug, "build"), /verdict is "fail"/);
  writeJson(join(dir, "review", "build.json"), review("build"));
  writeFileSync(join(dir, "site", "sections", "hero-warung.astro"), "<section>changed</section>");
  assert.throws(() => writeCheckpoint(slug, "build"), /bundle changed after it was checked/);
  writeBundle("<section>changed</section>");
  writeCheckpoint(slug, "build");
  // The lock file and local previews do not count as a change to the bundle.
  writeFileSync(join(dir, "site", "webto.lock.json"), "{}");
  writeFileSync(join(dir, "site", "preview-hero.html"), "<html>");
  writeCheckpoint(slug, "draft", { approved: "ya buat" });
});

test("a failed check is refused even when fresh", () => {
  throughPlan();
  writeBundle();
  writeJson(join(dir, "reports", "check.json"), { ok: false, bundleHash: hashBundle(join(dir, "site")) });
  writeJson(join(dir, "review", "build.json"), review("build"));
  assert.throws(() => writeCheckpoint(slug, "build"), /last check did not pass/);
});

test("redoing an earlier stage makes the later ones stale", () => {
  throughPlan();
  const pipeline = loadPipeline("client-site");
  assert.deepEqual(stageStates(dir, pipeline).slice(0, 4).map((s) => s.state), ["done", "done", "done", "todo"]);
  writeCheckpoint(slug, "brief");
  assert.deepEqual(stageStates(dir, pipeline).slice(0, 4).map((s) => s.state), ["done", "done", "stale", "todo"]);
  writeBundle();
  writeJson(join(dir, "review", "build.json"), review("build"));
  assert.throws(() => writeCheckpoint(slug, "build"), /plan \(stale\)/);
});

test("a stage redone too often stops the agent", () => {
  writeJson(join(dir, "reports", "preflight.json"), { ok: true });
  for (let i = 0; i < 4; i++) writeCheckpoint(slug, "preflight");
  assert.throws(() => writeCheckpoint(slug, "preflight"), /already redone 3 times/);
});

test("extractPage reads a page the way a migration needs it", () => {
  const html = `<!doctype html><html><head><title>Klinik Sehat &amp; Bahagia</title>
    <meta name="description" content="Klinik gigi keluarga di Bandung">
    <style>p{color:red}</style><script>var a = "<p>this text must never be read as content</p>"</script></head>
    <body><header><nav><a href="/">Beranda</a><a href="/layanan/">Layanan</a><a href="https://wix.com/x">Dibuat dengan Wix</a></nav></header>
    <h1>Senyum sehat untuk <em>keluarga</em></h1>
    <p>Kami melayani tambal gigi, scaling, dan behel sejak 2012.</p><p>pendek</p>
    <img src="/img/dokter.jpg" alt="Dokter kami"><img src="data:image/png;base64,AAAA">
    <a href="tel:+62 812 3456">Telepon</a> <a href="mailto:halo@klinik.test?subject=x">Email</a>
    <a href="https://wa.me/628123456">WA</a> <a href="https://www.instagram.com/klinik">IG</a>
    <a href="/wp-admin/">admin</a> <a href="/brosur.pdf">Brosur</a> <a href="/kontak#peta">Kontak</a></body></html>`;
  const { page, nav, contacts } = extractPage(html, "https://klinik.test/");
  assert.equal(page.title, "Klinik Sehat & Bahagia");
  assert.equal(page.description, "Klinik gigi keluarga di Bandung");
  assert.deepEqual(page.headings, [{ level: 1, text: "Senyum sehat untuk keluarga" }]);
  assert.deepEqual(page.text_blocks, ["Kami melayani tambal gigi, scaling, dan behel sejak 2012."]);
  assert.deepEqual(page.images, [{ src: "https://klinik.test/img/dokter.jpg", alt: "Dokter kami", rights: "unknown" }]);
  assert.deepEqual(page.links.sort(), ["https://klinik.test/", "https://klinik.test/kontak", "https://klinik.test/layanan/"]);
  assert.deepEqual(nav.map((n) => n.label), ["Beranda", "Layanan", "Dibuat dengan Wix"]);
  assert.deepEqual(contacts, { phones: ["+628123456"], emails: ["halo@klinik.test"], whatsapp: ["https://wa.me/628123456"], social: ["https://www.instagram.com/klinik"] });
});

// ── images ────────────────────────────────────────────────────────────────
const { parseDotEnv } = await import("../tools/lib/core.mjs");
const { MAX_IMAGE_BYTES, PROVIDERS, callProvider, fitImage, generateImage, imageSetup, setImageBudget } = await import("../tools/lib/image.mjs");
const { existsSync, readFileSync, statSync } = await import("node:fs");

const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const reply = (status, body, type = "application/json") => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": type } });

test(".env lines are read without the comments around them", () => {
  assert.deepEqual(parseDotEnv('# note\nGEMINI_API_KEY=abc\nIMAGE_PROVIDER=\n export FAL_KEY = "k 1" \nOPENAI_IMAGE_MODEL=gpt-image-2 # default\nnot a line\n'), {
    GEMINI_API_KEY: "abc",
    IMAGE_PROVIDER: "",
    FAL_KEY: "k 1",
    OPENAI_IMAGE_MODEL: "gpt-image-2",
  });
});

test("the provider is the one asked for, or the first that has a key", () => {
  assert.deepEqual(imageSetup({}), { configured: [], default: null });
  const env = { OPENAI_API_KEY: "o", FAL_KEY: "f", FAL_IMAGE_MODEL: "fal-ai/flux/dev" };
  assert.equal(imageSetup(env).default.provider, "openai");
  assert.deepEqual(imageSetup({ ...env, IMAGE_PROVIDER: "FAL" }).default, { provider: "fal", label: "fal.ai", model: "fal-ai/flux/dev" });
  assert.match(imageSetup({ ...env, IMAGE_PROVIDER: "gemini" }).problem, /has no key set/);
  assert.equal(imageSetup({ GOOGLE_API_KEY: "g" }).default.model, "gemini-3.1-flash-image");
});

test("each provider is asked the way its reference documents", () => {
  const a = { key: "K", model: "m/x", prompt: "a bowl of soup", aspect: "16:9" };
  const g = PROVIDERS.gemini.request(a);
  assert.equal(g.url, "https://generativelanguage.googleapis.com/v1/models/m%2Fx:generateContent");
  assert.deepEqual(g.headers, { "x-goog-api-key": "K" });
  assert.deepEqual(g.body, { contents: [{ parts: [{ text: "a bowl of soup" }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "16:9" } } });
  assert.match(PROVIDERS.gemini.retry404(g).url, /\/v1beta\/models\//);

  const r = PROVIDERS.openrouter.request(a);
  assert.equal(r.url, "https://openrouter.ai/api/v1/images");
  assert.deepEqual(r.headers, { Authorization: "Bearer K" });
  assert.deepEqual(r.body, { model: "m/x", prompt: "a bowl of soup", aspect_ratio: "16:9" });

  const o = PROVIDERS.openai.request(a);
  assert.equal(o.url, "https://api.openai.com/v1/images/generations");
  assert.deepEqual(o.body, { model: "m/x", prompt: "a bowl of soup", size: "1536x1024", output_format: "jpeg" });
  assert.equal(PROVIDERS.openai.request({ ...a, aspect: "3:4" }).body.size, "1024x1536");
  assert.equal(PROVIDERS.openai.request({ ...a, aspect: "1:1" }).body.size, "1024x1024");

  const f = PROVIDERS.fal.request({ ...a, model: "fal-ai/flux/schnell" });
  assert.equal(f.url, "https://fal.run/fal-ai/flux/schnell");
  assert.deepEqual(f.headers, { Authorization: "Key K" });
  assert.deepEqual(f.body, { prompt: "a bowl of soup", image_size: "landscape_16_9", num_images: 1, output_format: "jpeg" });
});

test("each provider's answer is read from where its reference puts the image", async () => {
  const args = { key: "K", model: "m", prompt: "a bowl of soup", aspect: "1:1" };
  const gem = await callProvider("gemini", args, async () => reply(200, { candidates: [{ content: { parts: [{ text: "here" }, { inlineData: { mimeType: "image/png", data: PIXEL } }] } }] }));
  assert.equal(gem.contentType, "image/png");
  assert.equal(gem.bytes.subarray(1, 4).toString(), "PNG");
  const orr = await callProvider("openrouter", args, async () => reply(200, { data: [{ b64_json: PIXEL, media_type: "image/png" }] }));
  assert.equal(orr.bytes.length, gem.bytes.length);
  const oai = await callProvider("openai", args, async () => reply(200, { data: [{ b64_json: PIXEL }] }));
  assert.equal(oai.contentType, "image/jpeg");
  const calls = [];
  const fal = await callProvider("fal", args, async (url) => {
    calls.push(String(url));
    return calls.length === 1 ? reply(200, { images: [{ url: "https://v3.fal.media/files/x.jpg", content_type: "image/jpeg" }] }) : new Response(Buffer.from(PIXEL, "base64"), { status: 200, headers: { "content-type": "image/jpeg" } });
  });
  assert.deepEqual(calls, ["https://fal.run/m", "https://v3.fal.media/files/x.jpg"]);
  assert.equal(fal.contentType, "image/jpeg");
});

test("a refusal or an answer without an image is an error that never shows the key", async () => {
  const args = { key: "SECRET-KEY", model: "m", prompt: "a bowl of soup", aspect: "1:1" };
  await assert.rejects(callProvider("openai", args, async () => reply(401, { error: { message: "Incorrect API key provided" } })), (e) => /OpenAI refused the request \(HTTP 401\): Incorrect API key/.test(e.message) && !e.message.includes("SECRET-KEY"));
  await assert.rejects(callProvider("gemini", args, async () => reply(200, { candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }] })), /Gemini returned no image \(IMAGE_SAFETY\)/);
  await assert.rejects(callProvider("fal", args, async () => reply(422, { detail: [{ msg: "field required" }] })), /fal\.ai refused the request \(HTTP 422\)/);
  // A preview model that only v1beta serves: one retry there.
  const urls = [];
  await callProvider("gemini", args, async (url) => {
    urls.push(String(url));
    return urls.length === 1 ? reply(404, { error: { message: "not found" } }) : reply(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PIXEL } }] } }] });
  });
  assert.match(urls[1], /\/v1beta\//);
});

test("an image is made only inside a budget the user agreed to", async () => {
  const env = { OPENROUTER_API_KEY: "k" };
  let sent = 0;
  const fetchImpl = async () => (sent++, reply(200, { data: [{ b64_json: PIXEL, media_type: "image/png" }] }));
  const ask = { prompt: "A wooden counter with bowls of soup, morning light", out: "hero-counter.png", aspect: "4:3" };

  await assert.rejects(generateImage(slug, { ...ask, out: "../x.png" }, { env, fetchImpl }), /--out is a file name/);
  await assert.rejects(generateImage(slug, { ...ask, aspect: "21:9" }, { env, fetchImpl }), /--aspect must be one of/);
  await assert.rejects(generateImage(slug, ask, { env: {}, fetchImpl }), /No image provider is configured/);
  const dry = await generateImage(slug, { ...ask, dryRun: true }, { env, fetchImpl });
  assert.deepEqual([dry.provider, dry.model, dry.budget], ["openrouter", "google/gemini-2.5-flash-image", null]);
  await assert.rejects(generateImage(slug, ask, { env, fetchImpl }), /No image budget for this project yet/);
  assert.throws(() => setImageBudget(slug, { max: 1 }), /pass --approved/);
  assert.throws(() => setImageBudget(slug, { max: 0, approved: "ya" }), /from 1 to 60/);
  assert.equal(sent, 0);

  setImageBudget(slug, { max: 1, approved: "ya, satu gambar saja" });
  const made = await generateImage(slug, ask, { env, fetchImpl });
  assert.equal(made.ref, "asset:hero-counter.png");
  assert.equal(made.used, 1);
  assert.ok(existsSync(join(dir, "site", "assets", "hero-counter.png")));
  const record = JSON.parse(readFileSync(join(dir, "generated_images.json"), "utf8"));
  assert.deepEqual([record.images[0].file, record.images[0].provider, record.images[0].aspect], ["hero-counter.png", "openrouter", "4:3"]);
  await assert.rejects(generateImage(slug, { ...ask, out: "second.png" }, { env, fetchImpl }), /budget is used up \(1 of 1\)/);
  assert.equal(sent, 1);
});

test("a large image is brought under the platform's limit when sharp is installed", async (t) => {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return t.skip("sharp is not installed");
  }
  // Soft colour noise, enlarged: detailed like a photograph, and as a PNG far above 2 MB.
  const { randomBytes } = await import("node:crypto");
  const small = await sharp(randomBytes(600 * 400 * 3), { raw: { width: 600, height: 400, channels: 3 } }).png().toBuffer();
  const big = await sharp(small).resize({ width: 3000, height: 2000, kernel: "cubic" }).png({ compressionLevel: 1 }).toBuffer();
  assert.ok(big.length > MAX_IMAGE_BYTES);
  const fitted = await fitImage({ bytes: big, contentType: "image/png" }, "jpg");
  assert.equal(fitted.ext, "jpg");
  assert.ok(fitted.bytes.length <= MAX_IMAGE_BYTES, `${fitted.bytes.length} bytes`);
  assert.equal((await sharp(fitted.bytes).metadata()).format, "jpeg");
  // Without sharp the bytes are kept and the name follows what the provider sent.
  assert.deepEqual(await fitImage({ bytes: big, contentType: "image/png" }, "jpg", null), { bytes: big, ext: "png", converted: false });
});

// ── stock photos ──────────────────────────────────────────────────────────
const { STOCK, searchStock, stockSetup, useStock } = await import("../tools/lib/stock.mjs");

const UNSPLASH_HIT = {
  id: "abc", width: 4000, height: 3000, alt_description: "bowls of spices on a table",
  urls: { raw: "https://images.unsplash.com/photo-1?ixid=x", small: "https://images.unsplash.com/photo-1?w=400" },
  links: { html: "https://unsplash.com/photos/abc", download_location: "https://api.unsplash.com/photos/abc/download?ixid=x" },
  user: { name: "Ana Lim", links: { html: "https://unsplash.com/@analim" } },
};
const PEXELS_HIT = { id: 7, width: 3000, height: 2000, url: "https://www.pexels.com/photo/7/", photographer: "Budi S", photographer_url: "https://www.pexels.com/@budi", alt: "soup", src: { original: "https://images.pexels.com/7.jpeg", large2x: "https://images.pexels.com/7.jpeg?w=1880", medium: "https://images.pexels.com/7.jpeg?h=350" } };
const PIXABAY_HIT = { id: 9, pageURL: "https://pixabay.com/photos/soup-9/", tags: "soup, bowl", webformatURL: "https://pixabay.com/get/w.jpg", largeImageURL: "https://pixabay.com/get/l.jpg", imageWidth: 5000, imageHeight: 3000, user: "citra", user_id: 42 };

test("each stock library is searched the way its reference documents", () => {
  const a = { key: "K", query: "soup bowl", orientation: "square", count: 6 };
  assert.equal(STOCK.unsplash.searchUrl(a), "https://api.unsplash.com/search/photos?query=soup+bowl&per_page=6&orientation=squarish");
  assert.deepEqual(STOCK.unsplash.headers("K"), { Authorization: "Client-ID K", "Accept-Version": "v1" });
  assert.equal(STOCK.pexels.searchUrl(a), "https://api.pexels.com/v1/search?query=soup+bowl&per_page=6&orientation=square");
  assert.deepEqual(STOCK.pexels.headers("K"), { Authorization: "K" });
  assert.equal(STOCK.pixabay.searchUrl(a), "https://pixabay.com/api/?key=K&q=soup+bowl&image_type=photo&safesearch=true&per_page=6");
  assert.match(STOCK.pixabay.searchUrl({ ...a, orientation: "landscape", count: 1 }), /per_page=3&orientation=horizontal$/);
  assert.match(STOCK.pixabay.searchUrl({ ...a, orientation: "portrait" }), /orientation=vertical$/);

  assert.deepEqual(STOCK.unsplash.parse({ results: [UNSPLASH_HIT] })[0], {
    id: "abc", width: 4000, height: 3000, description: "bowls of spices on a table", photographer: "Ana Lim",
    photographerUrl: "https://unsplash.com/@analim?utm_source=webto-studio&utm_medium=referral",
    pageUrl: "https://unsplash.com/photos/abc?utm_source=webto-studio&utm_medium=referral",
    preview: "https://images.unsplash.com/photo-1?w=400", full: "https://images.unsplash.com/photo-1?ixid=x",
    downloadLocation: "https://api.unsplash.com/photos/abc/download?ixid=x",
  });
  assert.equal(STOCK.pexels.parse({ photos: [PEXELS_HIT] })[0].full, "https://images.pexels.com/7.jpeg?w=1880");
  const pix = STOCK.pixabay.parse({ hits: [PIXABAY_HIT] })[0];
  assert.deepEqual([pix.full, pix.photographer, pix.photographerUrl], ["https://pixabay.com/get/l.jpg", "citra", "https://pixabay.com/users/citra-42/"]);
  assert.equal(stockSetup({ PEXELS_API_KEY: "p", PIXABAY_API_KEY: "x" }).default.provider, "pexels");
  assert.match(stockSetup({ PEXELS_API_KEY: "p", STOCK_PROVIDER: "unsplash" }).problem, /has no key set/);
});

test("an Unsplash photo stays on Unsplash, counts a download, and needs a credit", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push([String(url), init?.headers?.Authorization ?? null]);
    if (String(url).startsWith("https://api.unsplash.com/search")) return reply(200, { results: [UNSPLASH_HIT] });
    return new Response(Buffer.from(PIXEL, "base64"), { status: 200, headers: { "content-type": "image/jpeg" } });
  };
  const env = { UNSPLASH_ACCESS_KEY: "K" };
  await assert.rejects(searchStock(slug, { query: "soup" }, { env: {}, fetchImpl }), /No stock library is configured/);
  await assert.rejects(useStock(slug, { pick: 1 }, { env, fetchImpl }), /Search first/);
  const found = await searchStock(slug, { query: "soup bowl", orientation: "landscape" }, { env, fetchImpl });
  assert.deepEqual([found.delivery, found.results.length, found.results[0].previewFile], ["hotlink", 1, "reports/stock/1.jpg"]);
  assert.ok(existsSync(join(dir, "reports", "stock", "1.jpg")));
  await assert.rejects(useStock(slug, { pick: 2 }, { env, fetchImpl }), /--pick is a number from 1 to 1/);

  const used = await useStock(slug, { pick: 1 }, { env, fetchImpl });
  assert.equal(used.ref, "https://images.unsplash.com/photo-1?ixid=x&w=1920&q=80&auto=format&fit=max");
  assert.deepEqual([used.file, used.creditRule, used.credit], [null, "required", "Photo by Ana Lim on Unsplash"]);
  assert.deepEqual(seen.at(-1), ["https://api.unsplash.com/photos/abc/download?ixid=x", "Client-ID K"]);
  assert.ok(!existsSync(join(dir, "site", "assets")), "nothing is downloaded into the bundle");
  assert.equal(JSON.parse(readFileSync(join(dir, "stock_images.json"), "utf8")).images[0].photographerUrl, "https://unsplash.com/@analim?utm_source=webto-studio&utm_medium=referral");
});

test("Pexels and Pixabay photos are downloaded into the bundle", async () => {
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.startsWith("https://api.pexels.com/")) return reply(200, { photos: [PEXELS_HIT] });
    if (u.startsWith("https://pixabay.com/api/")) return reply(200, { hits: [PIXABAY_HIT] });
    return new Response(Buffer.from(PIXEL, "base64"), { status: 200, headers: { "content-type": "image/png" } });
  };
  const env = { PEXELS_API_KEY: "p", PIXABAY_API_KEY: "x" };
  await searchStock(slug, { query: "soup" }, { env, fetchImpl });
  await assert.rejects(useStock(slug, { pick: 1 }, { env, fetchImpl }), /pass --out <name>\.jpg/);
  const pex = await useStock(slug, { pick: 1, out: "soup.png" }, { env, fetchImpl });
  assert.deepEqual([pex.ref, pex.creditRule, pex.credit, pex.path], ["asset:soup.png", "asked", "Photo by Budi S on Pexels", "site/assets/soup.png"]);
  assert.ok(statSync(join(dir, "site", "assets", "soup.png")).size > 0);

  await searchStock(slug, { query: "soup", provider: "pixabay" }, { env, fetchImpl });
  const pix = await useStock(slug, { pick: 1, out: "bowl.png" }, { env, fetchImpl });
  assert.deepEqual([pix.ref, pix.creditRule], ["asset:bowl.png", "none"]);
  assert.equal(JSON.parse(readFileSync(join(dir, "stock_images.json"), "utf8")).images.length, 2);
});

test("a refused search says why and never shows the key", async () => {
  const fetchImpl = async () => reply(401, { errors: ["OAuth error: The access token is invalid"] });
  await assert.rejects(searchStock(slug, { query: "soup" }, { env: { UNSPLASH_ACCESS_KEY: "SECRET-KEY" }, fetchImpl }), (e) => /Unsplash refused the search \(HTTP 401\): OAuth error/.test(e.message) && !e.message.includes("SECRET-KEY"));
  await assert.rejects(searchStock(slug, { query: "soup" }, { env: { PIXABAY_API_KEY: "SECRET-KEY" }, fetchImpl: async () => reply(429, "API rate limit exceeded", "text/plain") }), (e) => /HTTP 429.*hourly limit/.test(e.message) && !e.message.includes("SECRET-KEY"));
});

test("robots.txt rules for every crawler are read, others ignored", () => {
  assert.deepEqual(parseRobots("User-agent: Googlebot\nDisallow: /a\n\nUser-agent: *\nDisallow: /private/ # x\nDisallow:\nAllow: /\n"), ["/private/"]);
  assert.equal(decodeEntities("A &amp; B &#8211; &#x26;"), "A & B – &");
});
