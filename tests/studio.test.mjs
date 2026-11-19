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

test("robots.txt rules for every crawler are read, others ignored", () => {
  assert.deepEqual(parseRobots("User-agent: Googlebot\nDisallow: /a\n\nUser-agent: *\nDisallow: /private/ # x\nDisallow:\nAllow: /\n"), ["/private/"]);
  assert.equal(decodeEntities("A &amp; B &#8211; &#x26;"), "A & B – &");
});
