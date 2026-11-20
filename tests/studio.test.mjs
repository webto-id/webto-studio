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
  business: { name: "Warung Senja", kind: "warung", country: "ID", playbook: "kuliner" },
  language: "id",
  goal: "Pesan lewat WhatsApp",
  facts: [{ field: "address", value: "Jl. Contoh 1", source: "user" }],
  open_questions: [],
  ...extra,
});
const plan = () => ({
  pages: [{ title: "Beranda", slug: "", sections: [{ type: "hero", variant: "hero-warung", purpose: "Say what the place is", layout: "type over full-bleed photo" }] }],
  variants: [{ key: "hero-warung", sectionType: "hero" }],
  limits: { checked_at: "2026-11-19T00:00:00Z", fits: true },
});
const candidate = (name, territory, portability = 2) => ({
  name,
  territory,
  idea: `The site as ${name}, taken from the warung's own evening`,
  anchor: "Opens at dusk on Jl. Contoh",
  anchor_source: "brief",
  decisions: { layout: "one long evening", type: "hand-set serif", colour: "dusk to night", imagery: "snapshots", signature: "the sky darkens on scroll" },
  swap_test: "Another warung that opens at noon loses the whole idea",
  scores: { originality: 4, fit: 5, feasibility: 4, portability },
});
const concept = (extra = {}) => ({
  candidates: [candidate("Senja", "name"), candidate("Papan harga", "place"), candidate("Satu nota", "system")],
  chosen: "Senja",
  why: "The name and the opening hour are the same fact",
  idea: "The site is one evening at the warung, from dusk to closing",
  anchor: "Opens at dusk on Jl. Contoh",
  signature: "hero-warung: the sky darkens as you scroll",
  motion: "settle, like the light going down",
  first_screen: "The name set large against a dusk sky, the WhatsApp order button under it, at 390 and 1280",
  generic_check: [
    { part: "first_screen", generic: true, change: "No centred headline over a dim photo; the name is the sky" },
    { part: "palette", generic: false },
    { part: "type", generic: false },
    { part: "layout", generic: false },
    { part: "imagery", generic: false },
  ],
  ...extra,
});
const direction = (extra = {}) => ({
  concept: concept(),
  language: "Warm paper tones, hand-set headings, photos tilted a few degrees like snapshots on a counter.",
  palette: { primary: "#b45309", background: "#fffbeb", foreground: "#1c1917" },
  fonts: { heading: "Fraunces", body: "Inter" },
  moves: ["Headings in a serif with tight leading", "Photos tilted two degrees with a soft shadow"],
  avoid: ["A corporate blue gradient hero"],
  ...extra,
});
const seoPage = (extra = {}) => ({
  slug: "",
  query: "warung makan malam jalan contoh",
  intent: "Find a place to eat tonight and order ahead",
  title: "Warung Senja, makan malam rumahan di Jl. Contoh",
  description: "Masakan rumahan dari sore sampai tutup di Jl. Contoh 1. Pesan lewat WhatsApp, ambil di warung tanpa antre.",
  h1: "Makan malam rumahan di Jl. Contoh",
  ...extra,
});
const seoPlan = (extra = {}) => ({
  searcher: { who: "Someone near Jl. Contoh looking for dinner", place: "Jl. Contoh, Yogyakarta" },
  business_type: "FoodEstablishment",
  pages: [seoPage()],
  profile: [{ field: "address", from: "address" }, { field: "businessType", from: "kind" }],
  ...extra,
});
const review = (stage, extra = {}) => ({ stage, looked_at: ["preview-hero-warung.html"], findings: [], checks_not_done: [], verdict: "pass", ...extra });

function throughPlan() {
  writeJson(join(dir, "reports", "preflight.json"), { ok: true });
  writeCheckpoint(slug, "preflight");
  writeJson(join(dir, "brief.json"), brief());
  writeCheckpoint(slug, "brief");
  writeJson(join(dir, "site_plan.json"), plan());
  writeJson(join(dir, "design_direction.json"), direction());
  writeJson(join(dir, "seo_plan.json"), seoPlan());
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
  writeJson(join(dir, "seo_plan.json"), seoPlan());
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

// ── 3D models ─────────────────────────────────────────────────────────────
const { inspectGlb, reserveModel, setModelBudget } = await import("../tools/lib/model.mjs");
const { mkdirSync: mkdir } = await import("node:fs");

/** A minimal, valid .glb around the given glTF JSON (4-byte padded, with a small BIN chunk). */
function glb(gltf, binSize = 8) {
  let json = Buffer.from(JSON.stringify(gltf));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const bin = Buffer.alloc(binSize);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(json.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, json, bh, bin]);
}
const JAR = {
  asset: { version: "2.0" },
  extensionsUsed: ["KHR_draco_mesh_compression"],
  accessors: [{ count: 300 }, { count: 900 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  materials: [{}],
  buffers: [{ byteLength: 8 }],
};

test("a .glb is read for what the platform's runtime will meet", async () => {
  const ok = await inspectGlb(glb(JAR), null);
  assert.deepEqual([ok.meshes, ok.vertices, ok.triangles, ok.materials, ok.compression, ok.problems], [1, 300, 300, 1, "draco", []]);

  const bad = await inspectGlb(glb({ ...JAR, extensionsUsed: ["KHR_texture_basisu"], buffers: [{ byteLength: 8 }, { uri: "model.bin" }], images: [{ uri: "wood.png" }, { uri: "data:image/png;base64,AA" }] }), null);
  assert.equal(bad.problems.length, 3);
  assert.match(bad.problems[0], /KTX2/);
  assert.match(bad.problems[1], /Buffer 1 is a separate file \(model\.bin\)/);
  assert.match(bad.problems[2], /Image 0 is a separate file \(wood\.png\)/);

  assert.match((await inspectGlb(Buffer.from('{"asset":{"version":"2.0"}}                '), null)).problems[0], /Not a \.glb file/);
  assert.match((await inspectGlb(glb({ asset: { version: "2.0" } }), null)).problems[0], /no mesh/);
  const huge = await inspectGlb(glb(JAR, 10 * 1024 * 1024 + 4), null);
  assert.match(huge.problems[0], /above the platform's 10 MB limit/);
  const heavy = await inspectGlb(glb({ ...JAR, extensionsUsed: [], accessors: [{ count: 400000 }, { count: 1200000 }] }, 4 * 1024 * 1024), null);
  assert.deepEqual([heavy.problems.length, heavy.advice.length, heavy.triangles], [0, 3, 400000]);
});

test("a generated model needs a budget, and the manifest must agree with it", () => {
  assert.throws(() => reserveModel(slug, { what: "a ceramic jar with a lid" }), /No model budget for this project yet/);
  assert.throws(() => setModelBudget(slug, { max: 2 }), /pass --approved/);
  assert.throws(() => setModelBudget(slug, { max: 11, approved: "ya" }), /from 1 to 10/);
  setModelBudget(slug, { max: 1, approved: "boleh, satu kali coba" });
  assert.equal(reserveModel(slug, { what: "a ceramic jar with a lid" }).used, 1);
  assert.throws(() => reserveModel(slug, { what: "a second jar, taller" }), /budget is used up \(1 of 1\)/);
});

test("the assets stage checks files, licences and generated models against the budget", () => {
  const d3 = createProject(`m${n}`, "landing-3d").dir;
  const s3 = `m${n}`;
  writeJson(join(d3, "reports", "preflight.json"), { ok: true });
  writeCheckpoint(s3, "preflight");
  writeJson(join(d3, "brief.json"), brief());
  writeJson(join(d3, "concept.json"), {
    for_whom: "People choosing a gift jar of sambal", promise: "See the jar from every side before ordering", differentiator: "The real jar turns as the page scrolls",
    three_d: { recipe: "model-glb", asset_source: "generated in this session", rights: "generated", fallback: "jar-poster.jpg" },
  });
  writeJson(join(d3, "design_direction.json"), direction());
  writeCheckpoint(s3, "concept", { approved: "ya" });

  const file = (extra) => ({ file: "jar.glb", kind: "model", bytes: 1000, role: "the turning jar", rights: "generated", origin: "ai-generated", made_with: "generator", ...extra });
  const manifest = (files, poster = "jar-poster.jpg") => writeJson(join(d3, "assets_manifest.json"), { poster, files: [...files, { file: "jar-poster.jpg", kind: "image", bytes: 10, role: "poster", rights: "generated", origin: "rendered" }] });
  mkdir(join(d3, "site", "assets"), { recursive: true });
  writeFileSync(join(d3, "site", "assets", "jar-poster.jpg"), "x");

  manifest([file()]);
  assert.throws(() => writeCheckpoint(s3, "assets"), /"jar\.glb" is not in site\/assets\/[\s\S]*1 generated model\(s\) listed but 0 reserved/);
  writeFileSync(join(d3, "site", "assets", "jar.glb"), "x");
  manifest([file({ origin: "library", rights: "licensed" })]);
  assert.throws(() => writeCheckpoint(s3, "assets"), /required property 'licence'/);
  manifest([file({ origin: "library", rights: "licensed", licence: "CC BY-NC 4.0", source_url: "https://example.test/jar" })]);
  assert.throws(() => writeCheckpoint(s3, "assets"), /does not allow use on a business's site/);
  manifest([file({ origin: "library", rights: "licensed", licence: "CC-BY 4.0", source_url: "https://example.test/jar", author: "A. Maker" })], "missing.jpg");
  assert.throws(() => writeCheckpoint(s3, "assets"), /poster "missing\.jpg" is not listed/);
  manifest([file({ origin: "library", rights: "licensed", licence: "CC-BY 4.0", source_url: "https://example.test/jar", author: "A. Maker" })]);
  writeCheckpoint(s3, "assets");

  manifest([file()]);
  setModelBudget(s3, { max: 2, approved: "dua kali coba" });
  reserveModel(s3, { what: "a ceramic jar with a lid" });
  writeCheckpoint(s3, "assets");
});

test("robots.txt rules for every crawler are read, others ignored", () => {
  assert.deepEqual(parseRobots("User-agent: Googlebot\nDisallow: /a\n\nUser-agent: *\nDisallow: /private/ # x\nDisallow:\nAllow: /\n"), ["/private/"]);
  assert.equal(decodeEntities("A &amp; B &#8211; &#x26;"), "A & B – &");
});

// ── concept and composition ───────────────────────────────────────────────
function toPlanGate(dd, sp = plan()) {
  writeJson(join(dir, "reports", "preflight.json"), { ok: true });
  writeCheckpoint(slug, "preflight");
  writeJson(join(dir, "brief.json"), brief());
  writeCheckpoint(slug, "brief");
  writeJson(join(dir, "site_plan.json"), sp);
  writeJson(join(dir, "design_direction.json"), dd);
  writeJson(join(dir, "seo_plan.json"), seoPlan());
}

test("a direction without a concept is refused", () => {
  const dd = direction();
  delete dd.concept;
  toPlanGate(dd);
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /required property 'concept'/);
});

test("the concept comes from three territories, and the chosen one is not a style", () => {
  toPlanGate(direction({ concept: concept({ candidates: [candidate("Senja", "name"), candidate("Sore", "name"), candidate("Satu nota", "system")] }) }));
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /three different territories, got name, name, system/);
  writeJson(join(dir, "design_direction.json"), direction({ concept: concept({ chosen: "Malam" }) }));
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /"Malam" is not the name of one of the candidates/);
  writeJson(join(dir, "design_direction.json"), direction({ concept: concept({ candidates: [candidate("Senja", "name", 4), candidate("Papan harga", "place"), candidate("Satu nota", "system")] }) }));
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /portability, so it would work for another business/);
  writeJson(join(dir, "design_direction.json"), direction({ concept: concept({ candidates: [candidate("Senja", "name"), candidate("Papan harga", "place"), { ...candidate("Satu nota", "system"), anchor_source: "invented" }] }) }));
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /anchor_source: must be equal to one of the allowed values/);
});

test("the generic check covers the five parts, and a generic part names its change", () => {
  const check = concept().generic_check;
  toPlanGate(direction({ concept: concept({ generic_check: [...check.slice(0, 4), { part: "copy", generic: false }] }) }));
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /generic_check has no entry for "imagery"/);
  writeJson(join(dir, "design_direction.json"), direction({ concept: concept({ generic_check: [...check.slice(0, 4), { part: "imagery", generic: true }] }) }));
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /"imagery" is where a generic model would land, and names no change/);
  writeJson(join(dir, "design_direction.json"), direction());
  writeCheckpoint(slug, "plan", { approved: "ya" });
});

test("neighbouring sections get different layouts; the navbar and footer do not count", () => {
  const s = (type, layout) => ({ type, variant: "hero-warung", purpose: "p", layout });
  const sp = plan();
  sp.pages[0].sections = [s("navbar", "bar"), s("hero", "split image right"), s("features", "Split image right"), s("footer", "bar")];
  toPlanGate(direction(), sp);
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /two sections in a row use the layout "Split image right"/);
  sp.pages[0].sections = [s("navbar", "bar"), s("hero", "split image right"), s("features", "index list"), s("cta", "split image right"), s("footer", "bar")];
  writeJson(join(dir, "site_plan.json"), sp);
  writeCheckpoint(slug, "plan", { approved: "ya" });
});

// ── the blind critic ──────────────────────────────────────────────────────
const { criticBrief, judgeCritique, overallOf } = await import("../tools/lib/critic.mjs");

function toVerify() {
  throughPlan();
  writeBundle();
  writeJson(join(dir, "review", "build.json"), review("build"));
  writeCheckpoint(slug, "build");
  writeFileSync(join(dir, "site", "webto.lock.json"), "{}");
  writeCheckpoint(slug, "draft", { approved: "ya buat" });
  writeJson(join(dir, "review", "verify.json"), review("verify", { looked_at: ["shots/home-390.png"] }));
  auditReport();
}
function shots(at = "2026-11-19T10:00:00.000Z") {
  mkdirSync(join(dir, "shots"), { recursive: true });
  const list = [
    { label: "home", width: 390, scheme: "light", reducedMotion: false, file: "shots/home-390.png", fold: "shots/home-390-fold.png", overflowPx: 0, brokenImages: [], consoleErrors: [] },
    { label: "hero-warung", local: true, width: 390, scheme: "light", reducedMotion: false, file: "shots/hero-warung-390-local.png", overflowPx: 0, brokenImages: [], consoleErrors: [] },
  ];
  for (const s of list) for (const f of [s.file, s.fold].filter(Boolean)) writeFileSync(join(dir, ...f.split("/")), "png");
  writeJson(join(dir, "shots", "index.json"), { at, shots: list, problems: [] });
  return at;
}
const score = (n, file = "shots/home-390-fold.png") => ({ score: n, evidence: [{ file, note: "what the frame shows" }] });
function critique(pass, at, s = [8, 7.5, 7, 6.5], extra = {}) {
  writeJson(join(dir, "critique", `pass-${pass}.json`), {
    pass,
    critic: "subagent",
    shots_at: at,
    business_read: "A small warung in Yogyakarta that takes orders on WhatsApp",
    idea_read: "One evening at the warung, from dusk to closing",
    scores: { design: score(s[0]), usability: score(s[1]), distinctiveness: score(s[2]), content: score(s[3]) },
    fixes: [{ criterion: "usability", file: "shots/home-390-fold.png", what: "The order button sits low", change: "Move it under the name" }],
    ...extra,
  });
}

test("the critic's brief lists the visitor's screenshots only, and needs some", () => {
  toVerify();
  const pipeline = loadPipeline("client-site");
  assert.throws(() => criticBrief(dir, pipeline), /No screenshots yet/);
  mkdirSync(join(dir, "shots"), { recursive: true });
  writeJson(join(dir, "shots", "index.json"), { at: "x", shots: [{ label: "hero", local: true, width: 390, file: "shots/hero-390.png" }] });
  assert.throws(() => criticBrief(dir, pipeline), /Only local previews were captured/);
  const at = shots();
  const b = criticBrief(dir, pipeline);
  assert.equal(b.n, 1);
  assert.match(b.text, /home-390-fold\.png {2}\(home, 390 px, light, first screen\)/);
  assert.match(b.text, /home-390\.png {2}\(home, 390 px, light, whole page\)/);
  assert.doesNotMatch(b.text, /hero-warung-390-local/);
  assert.ok(b.text.includes(`"shots_at": "${at}"`));
  assert.match(b.text, /critic-rubric\.md/);
  assert.match(b.out, /critique[\\/]pass-1\.json$/);
});

test("a long page reaches the critic in parts, not as one shrunk image", () => {
  toVerify();
  mkdirSync(join(dir, "shots"), { recursive: true });
  const parts = ["shots/home-1280-part-1.png", "shots/home-1280-part-2.png"];
  writeJson(join(dir, "shots", "index.json"), { at: "t", shots: [{ label: "home", width: 1280, scheme: "dark", reducedMotion: true, file: "shots/home-1280-dark-still.png", fold: "shots/home-1280-dark-still-fold.png", parts }] });
  const { text } = criticBrief(dir, loadPipeline("client-site"));
  assert.match(text, /home-1280-part-1\.png {2}\(home, 1280 px, dark, reduced motion, part 1 of 2, top to bottom\)/);
  assert.match(text, /home-1280-part-2\.png/);
  assert.doesNotMatch(text, /whole page/);
});

test("verify needs a critique of the current screenshots that meets the bar", () => {
  toVerify();
  const at = shots();
  assert.throws(() => writeCheckpoint(slug, "verify"), /No critique yet/);
  critique(1, at, [6, 6, 5.5, 5]);
  assert.equal(overallOf(JSON.parse(readFileSync(join(dir, "critique", "pass-1.json"), "utf8")).scores), 5.8);
  assert.throws(() => writeCheckpoint(slug, "verify"), /overall 5\.8, the bar is 7 with every criterion at least 6 \(under: distinctiveness, content\)\. Work through the fixes/);
  // A pass is final: the same screenshots cannot be judged again.
  assert.throws(() => criticBrief(dir, loadPipeline("client-site")), /Pass 1 already judged these screenshots/);
  const at2 = shots("2026-11-19T11:00:00.000Z");
  assert.equal(criticBrief(dir, loadPipeline("client-site")).n, 2);
  critique(2, at2, undefined, { scores: { design: score(8, "shots/nope.png"), usability: score(8), distinctiveness: score(8), content: score(8) } });
  assert.throws(() => writeCheckpoint(slug, "verify"), /design cites shots\/nope\.png, which does not exist/);
  critique(2, at2);
  shots("2026-11-19T12:00:00.000Z");
  assert.throws(() => writeCheckpoint(slug, "verify"), /the screenshots changed after this critique/);
  shots(at2);
  const { checkpoint, warnings } = writeCheckpoint(slug, "verify");
  assert.deepEqual(checkpoint.critique, { pass: 2, critic: "subagent", overall: 7.5, scores: { design: 8, usability: 7.5, distinctiveness: 7, content: 6.5 }, met: true });
  assert.deepEqual(warnings, []);
  assert.deepEqual(checkpoint.artifacts.find((a) => a.name === "critique"), { name: "critique", path: "critique/pass-2.json" });
});

test("after the last pass under the bar only the user can accept the site; a self-score is flagged", () => {
  toVerify();
  for (let i = 1; i <= 3; i++) critique(i, shots(`2026-11-19T1${i}:00:00.000Z`), [6, 6, 6, 6]);
  assert.throws(() => criticBrief(dir, loadPipeline("client-site")), /Pass 3 already judged/);
  shots("2026-11-19T15:00:00.000Z");
  assert.throws(() => criticBrief(dir, loadPipeline("client-site")), /3 critic passes are done/);
  critique(3, "2026-11-19T15:00:00.000Z", [6, 6, 6, 6], { critic: "self" });
  assert.throws(() => writeCheckpoint(slug, "verify"), /That was the last pass\. Show the user the scores/);
  const { checkpoint, warnings } = writeCheckpoint(slug, "verify", { belowBar: "tidak apa-apa, foto asli menyusul" });
  assert.equal(checkpoint.critique.below_bar, "tidak apa-apa, foto asli menyusul");
  assert.equal(warnings.length, 2);
  assert.match(warnings.join("\n"), /Accepted under the bar by the user[\s\S]*self-score, not an independent one/);
});

test("a malformed critique is redone under its own number", () => {
  toVerify();
  const at = shots();
  writeJson(join(dir, "critique", "pass-1.json"), { pass: 1, critic: "subagent", shots_at: at });
  assert.throws(() => writeCheckpoint(slug, "verify"), /critique\/pass-1\.json\(root\): must have required property 'business_read'/);
  assert.equal(criticBrief(dir, loadPipeline("client-site")).n, 1);
  assert.equal(judgeCritique(dir, loadPipeline("client-site")).summary, undefined);
});

// ── search: the plan and the audit ────────────────────────────────────────
const { judgeAudit, slugOf } = await import("../tools/lib/audit.mjs");

function auditPage(extra = {}) {
  const p = seoPage();
  return {
    label: "home", url: "https://senja.wpage.id/", path: "/", slug: "", status: 200,
    title: p.title, description: p.description, robots: null, canonical: "https://senja.wpage.id/", lang: "id", ogImage: "https://senja.wpage.id/r2/og.jpg",
    headings: [{ level: 1, text: p.h1, hidden: false }, { level: 2, text: "Menu malam ini", hidden: false }],
    images: [{ src: "https://senja.wpage.id/r2/depan.jpg", alt: "Bagian depan Warung Senja", naturalWidth: 800, width: 350, lazy: false, firstScreen: true, decorative: false }],
    internalLinks: [{ path: "/", text: "Beranda" }], externalLinks: 1, emptyLinks: 0,
    jsonLd: { types: ["FoodEstablishment", "WebSite", "WebPage"], errors: [], org: { type: "FoodEstablishment", address: true, phone: true, hours: false } },
    words: 320, bytes: 600000, lcp: { tag: "img", src: "https://senja.wpage.id/r2/depan.jpg", lazy: false, ms: 900 },
    ...extra,
  };
}
function auditReport(pages = [auditPage()], extra = {}) {
  writeJson(join(dir, "reports", "audit.json"), { at: "2026-11-19T10:00:00.000Z", published: false, pages, ...extra });
}

test("the search plan gives every page its own search, and the home page names the place", () => {
  toPlanGate(direction());
  const sp = plan();
  sp.pages.push({ title: "Menu", slug: "menu", sections: [{ type: "menu", variant: "hero-warung", purpose: "Show tonight's dishes", layout: "index list" }] });
  writeJson(join(dir, "site_plan.json"), sp);
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /no entry for the page "menu" of site_plan\.json/);
  writeJson(join(dir, "seo_plan.json"), seoPlan({ pages: [seoPage(), seoPage({ slug: "menu", title: "Menu Warung Senja hari ini", description: "Daftar masakan malam ini di Warung Senja, Jl. Contoh 1, dengan harga per porsi dan cara memesan lewat WhatsApp." })] }));
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /pages "home" and "menu" aim at the same search/);
  writeJson(join(dir, "seo_plan.json"), seoPlan({ pages: [seoPage(), seoPage({ slug: "menu", query: "menu nasi rames murah", title: "Daftar hidangan Warung Senja", description: "Daftar masakan malam ini di Warung Senja, Jl. Contoh 1, dengan harga per porsi dan cara memesan lewat WhatsApp." })] }));
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /page "menu": the title uses no word of its query "menu nasi rames murah"/);
  writeJson(join(dir, "seo_plan.json"), seoPlan({ pages: [seoPage({ title: "Warung Senja, makan malam rumahan", h1: "Makan malam rumahan" })], profile: [{ field: "openingHours", from: "hours" }] }));
  writeJson(join(dir, "site_plan.json"), plan());
  assert.throws(() => writeCheckpoint(slug, "plan", { approved: "ya" }), /title and h1 do not name the place \(Jl\. Contoh, Yogyakarta\)[\s\S]*profile "openingHours" comes from "hours", which is not a fact in brief\.json/);
  writeJson(join(dir, "seo_plan.json"), seoPlan({ pages: [seoPage({ title: "Warung Senja, masakan rumahan dari sore sampai malam di Jl. Contoh" })] }));
  const { warnings } = writeCheckpoint(slug, "plan", { approved: "ya" });
  assert.match(warnings.join("\n"), /the title is 66 characters/);
});

test("the audit reads what the builder controls: one h1, alt, link text, the planned title", () => {
  const plans = { seoPlan: seoPlan(), sitePlan: plan() };
  assert.deepEqual(judgeAudit({ pages: [auditPage()] }, plans), { problems: [], warnings: [] });
  const bad = auditPage({
    title: "Beranda",
    headings: [{ level: 1, text: "Warung Senja", hidden: false }, { level: 1, text: "Menu", hidden: false }, { level: 4, text: "Sambal", hidden: false }],
    images: [{ src: "https://x/a.jpg", alt: null, naturalWidth: 3000, width: 300, lazy: true, firstScreen: true, decorative: false }],
    emptyLinks: 2,
    internalLinks: [{ path: "/kontak", text: "Kontak" }, { path: "/blog/resep", text: "klik di sini" }, { path: "/checkout", text: "Bayar" }],
    lcp: { tag: "img", src: "https://x/a.jpg", lazy: true },
    words: 40,
  });
  const { problems, warnings } = judgeAudit({ pages: [bad] }, plans);
  const all = problems.join("\n");
  assert.match(all, /2 <h1> on the page \("Warung Senja", "Menu"\)/);
  assert.match(all, /1 image\(s\) without alt/);
  assert.match(all, /2 link\(s\) with no text/);
  assert.match(all, /links to \/kontak, which no page of this site has/);
  assert.doesNotMatch(all, /\/checkout|\/blog/);
  assert.match(all, /the title is "Beranda", seo_plan\.json says/);
  const w = warnings.join("\n");
  assert.match(w, /<h4> straight after an <h1>/);
  assert.match(w, /is lazy-loaded/);
  assert.match(w, /only 40 words/);
  assert.match(w, /"klik di sini" says nothing/);
  assert.match(w, /3000px for a 300px slot/);
  // Every page of the plan is audited.
  const sp = plan();
  sp.pages.push({ title: "Menu", slug: "menu", sections: [] });
  assert.match(judgeAudit({ pages: [auditPage()] }, { sitePlan: sp }).problems.join(), /"menu" in site_plan\.json was not audited/);
  assert.equal(slugOf("/layanan/scaling"), "scaling");
  assert.equal(slugOf("/"), "");
});

test("a draft may say noindex; the public site may not, and its robots.txt must let crawlers in", () => {
  const draft = judgeAudit({ pages: [auditPage({ robots: "noindex, nofollow" })] }, {});
  assert.deepEqual(draft.problems, []);
  assert.match(draft.warnings.join(), /say noindex, as a draft should/);
  const live = judgeAudit(
    { published: true, pages: [auditPage({ robots: "noindex, nofollow", internalLinks: [{ path: "/menu", text: "Menu" }] })], site: { origin: "https://senja.wpage.id", robots: { blocksAll: true }, sitemap: { status: 200, paths: ["/"] }, linkStatus: { "/menu": 404 } } },
    {},
  );
  const all = live.problems.join("\n");
  assert.match(all, /says noindex, so search engines drop it/);
  assert.match(all, /robots\.txt on https:\/\/senja\.wpage\.id blocks every crawler/);
  assert.match(all, /links to \/menu, which answer with an error/);
});

test("verify needs an audit of the current draft with no problems", () => {
  toVerify();
  writeFileSync(join(dir, "site", "webto.lock.json"), JSON.stringify({ siteId: "s1", revision: 4 }));
  critique(1, shots());
  auditReport([auditPage({ headings: [] })], { lockRevision: 4 });
  assert.throws(() => writeCheckpoint(slug, "verify"), /audit: home: 0 <h1> on the page/);
  auditReport([auditPage()], { lockRevision: 3 });
  assert.throws(() => writeCheckpoint(slug, "verify"), /the draft changed after the audit \(revision 3, now 4\)/);
  auditReport([auditPage()], { lockRevision: 4 });
  const { checkpoint } = writeCheckpoint(slug, "verify");
  assert.ok(checkpoint.artifacts.some((a) => a.name === "audit" && a.path === "reports/audit.json"));
});

// ── category playbooks ────────────────────────────────────────────────────
const { LISTING_CATEGORIES, PLAYBOOK_SECTIONS, loadPlaybooks } = await import("../tools/lib/playbooks.mjs");

test("every playbook names a real category, interview table and business types, with every section in order", async () => {
  const { readFileSync: read } = await import("node:fs");
  const { ROOT } = await import("../tools/lib/core.mjs");
  const interview = read(join(ROOT, "skills", "core", "webto-website", "references", "interview.md"), "utf8");
  const types = JSON.parse(read(join(ROOT, "schemas", "seo_plan.schema.json"), "utf8")).properties.business_type.enum;
  const all = loadPlaybooks();
  assert.ok(all.size >= 8, `${all.size} playbooks`);
  for (const [key, p] of all) {
    assert.match(key, /^[a-z0-9]+(-[a-z0-9]+)*$/, key);
    assert.ok(LISTING_CATEGORIES.includes(p.listing_category), `${key}: listing_category ${p.listing_category}`);
    assert.ok(Array.isArray(p.covers) && p.covers.length, `${key}: covers`);
    assert.ok(interview.includes(`### ${p.interview}`), `${key}: interview heading "${p.interview}"`);
    for (const t of p.business_types) assert.ok(types.includes(t), `${key}: business type ${t}`);
    assert.match(String(p.country), /^[A-Z]{2}$/, `${key}: country`);
    assert.match(String(p.language), /^[a-z]{2}$/, `${key}: language`);
    const headings = [...p.body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    assert.deepEqual(headings, PLAYBOOK_SECTIONS, `${key}: sections`);
    assert.doesNotMatch(p.body, /PENDING|TODO/, `${key}: unfinished`);
  }
});

test("a brief names a playbook that exists, or none", () => {
  writeJson(join(dir, "reports", "preflight.json"), { ok: true });
  writeCheckpoint(slug, "preflight");
  writeJson(join(dir, "brief.json"), brief({ business: { name: "Warung Senja", kind: "warung", country: "ID" } }));
  assert.throws(() => writeCheckpoint(slug, "brief"), /required property 'playbook'/);
  writeJson(join(dir, "brief.json"), brief({ business: { name: "Warung Senja", kind: "warung", country: "ID", playbook: "restoran" } }));
  assert.throws(() => writeCheckpoint(slug, "brief"), /playbook "restoran" does not exist\. Choose one of .*kuliner/);
  writeJson(join(dir, "brief.json"), brief({ business: { name: "Warung Senja", kind: "warung", country: "ID", playbook: "none" } }));
  writeCheckpoint(slug, "brief");
});

test("a playbook applies only to a business in the country it was written for", () => {
  const s = `pc${n}`;
  const d = createProject(s, "client-site").dir;
  writeJson(join(d, "reports", "preflight.json"), { ok: true });
  writeCheckpoint(s, "preflight");
  writeJson(join(d, "brief.json"), brief({ business: { name: "Sunset Diner", kind: "diner", playbook: "kuliner" } }));
  assert.throws(() => writeCheckpoint(s, "brief"), /required property 'country'/);
  writeJson(join(d, "brief.json"), brief({ language: "en", business: { name: "Sunset Diner", kind: "diner", country: "US", playbook: "kuliner" } }));
  assert.throws(() => writeCheckpoint(s, "brief"), /playbook "kuliner" is written for businesses in ID.*this business is in US/);
  writeJson(join(d, "brief.json"), brief({ language: "en", business: { name: "Sunset Diner", kind: "diner", country: "US", playbook: "none" } }));
  writeCheckpoint(s, "brief");
  // An English site for a business in Indonesia keeps the rules; only a warning about the language.
  writeJson(join(d, "brief.json"), brief({ language: "en", business: { name: "Villa Senja", kind: "villa", country: "ID", playbook: "travel" } }));
  const { warnings } = writeCheckpoint(s, "brief");
  assert.ok(warnings.some((w) => /site is in "en".*rules still apply/.test(w)), warnings.join(" | "));
});

test("a template's concept names its playbook, and the category follows it", () => {
  const s = `tp${n}`;
  const d = createProject(s, "template-for-sale").dir;
  writeJson(join(d, "reports", "preflight.json"), { ok: true });
  writeCheckpoint(s, "preflight");
  const c = { for_whom: "A neighbourhood warung that takes orders on WhatsApp", promise: "A menu with prices people can order from", differentiator: "The menu is set like the shop's own price board", category: "Kuliner", pages: ["Beranda"] };
  writeJson(join(d, "concept.json"), c);
  writeJson(join(d, "design_direction.json"), direction({ concept: concept({ candidates: [{ ...candidate("Senja", "name"), anchor_source: "category" }, { ...candidate("Papan harga", "place"), anchor_source: "category" }, { ...candidate("Satu nota", "system"), anchor_source: "category" }] }) }));
  writeJson(join(d, "site_plan.json"), plan());
  assert.throws(() => writeCheckpoint(s, "concept", { approved: "ya" }), /no "playbook"/);
  writeJson(join(d, "concept.json"), { ...c, playbook: "kuliner", category: "Bisnis & Jasa" });
  assert.throws(() => writeCheckpoint(s, "concept", { approved: "ya" }), /category "Bisnis & Jasa" does not match the playbook's "Kuliner"/);
  writeJson(join(d, "concept.json"), { ...c, playbook: "kuliner", market: "AU" });
  assert.throws(() => writeCheckpoint(s, "concept", { approved: "ya" }), /written for businesses in ID.*this business is in AU/);
  writeJson(join(d, "concept.json"), { ...c, playbook: "kuliner" });
  writeCheckpoint(s, "concept", { approved: "ya" });
});
