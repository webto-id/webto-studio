// The search audit: what a search engine and a link preview read from the real
// pages. The platform writes the sitemap, robots.txt, canonical links and the
// structured data; the builder writes the titles, descriptions, headings,
// image text and links. This checks the builder's part against seo_plan.json,
// and, once the site is public, the platform's part on the live address.
//
// Collecting needs a browser; judging does not, so the checkpoint can judge the
// saved pages again against the plan as it is now.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { StudioError, now, readJson, writeJson } from "./core.mjs";
import { loadPipeline, loadProject } from "./pipelines.mjs";

export const TITLE_MAX = 60;
export const DESC_RANGE = [70, 160];
const THIN_WORDS = 120;
const HEAVY_BYTES = 3 * 1024 * 1024;
// Routes the platform serves on every site, besides the site's own pages.
const PLATFORM_PATHS = /^\/(blog|product|checkout|order|member|media|r2|illu|cart|api)(\/|$)|^\/(rss\.xml|sitemap[\w-]*\.xml|robots\.txt|llms\.txt|favicon\.ico)$/;
const GENERIC_ANCHORS = /^(klik( di)? sini|di sini|click here|here|disini)$/i;

function parsePages(pages) {
  const out = [];
  for (const p of pages) {
    const i = p.indexOf("=");
    if (i < 1) throw new StudioError(`--page takes label=url, got "${p}"`);
    const url = p.slice(i + 1);
    if (!/^https?:\/\//.test(url)) throw new StudioError(`Not a web address: ${url}. The audit reads the real draft or the public site, not a local preview`);
    out.push({ label: p.slice(0, i), url });
  }
  if (!out.length) throw new StudioError("Nothing to audit. Pass --page home=<url> for every page (the previewPages links, or the public addresses)");
  return out;
}

/** A page's slug from its address: "" for the home page, else the last path segment. */
export function slugOf(path) {
  const parts = String(path).split("/").filter(Boolean);
  return parts.length ? decodeURIComponent(parts.at(-1)) : "";
}

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const words = (s) => norm(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);

/** Read one page in a browser page that has already loaded it. */
async function collect(page, target) {
  const data = await page.evaluate(async () => {
    const attr = (sel, name) => document.querySelector(sel)?.getAttribute(name) ?? null;
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const text = (el) => (el.innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => ({
      level: Number(h.tagName[1]),
      text: text(h).slice(0, 160),
      hidden: !visible(h),
    }));
    const images = [...document.images]
      .map((img) => {
        const r = img.getBoundingClientRect();
        return {
          src: (img.currentSrc || img.src || "").slice(0, 200),
          alt: img.hasAttribute("alt") ? img.getAttribute("alt") : null,
          naturalWidth: img.naturalWidth,
          width: Math.round(r.width),
          lazy: img.loading === "lazy",
          firstScreen: r.top < window.innerHeight && r.bottom > 0 && r.width > 0,
          decorative: !!img.closest('[aria-hidden="true"],[role="presentation"]') || img.getAttribute("role") === "presentation",
        };
      })
      .filter((i) => i.width >= 24 || i.naturalWidth > 1);
    const links = [...document.querySelectorAll("a[href]")].map((a) => {
      const label = text(a) || a.getAttribute("aria-label") || [...a.querySelectorAll("img[alt]")].map((i) => i.alt).join(" ").trim() || a.getAttribute("title") || "";
      return { href: a.href, text: label.slice(0, 80) };
    });
    const jsonLd = { types: [], errors: [], org: null };
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const j = JSON.parse(s.textContent);
        const nodes = j["@graph"] ?? [j];
        for (const n of nodes) {
          const t = [].concat(n["@type"] ?? []);
          jsonLd.types.push(...t);
          if (!jsonLd.org && n["@id"]?.endsWith?.("#organization")) {
            jsonLd.org = { type: t.join(","), address: !!n.address, phone: !!n.telephone, hours: !!n.openingHoursSpecification };
          }
        }
      } catch (e) {
        jsonLd.errors.push(String(e.message).slice(0, 120));
      }
    }
    // The largest thing painted on the first screen, the one a slow phone waits for.
    const lcp = await new Promise((resolve) => {
      let last = null;
      try {
        new PerformanceObserver((list) => (last = list.getEntries().at(-1))).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}
      setTimeout(() => {
        const el = last?.element;
        resolve(el ? { tag: el.tagName.toLowerCase(), src: (last.url || "").slice(0, 200), lazy: el.loading === "lazy", ms: Math.round(last.startTime) } : null);
      }, 300);
    });
    const res = performance.getEntriesByType("resource");
    const nav = performance.getEntriesByType("navigation")[0];
    return {
      title: document.title ?? "",
      description: attr('meta[name="description"]', "content"),
      robots: attr('meta[name="robots"]', "content"),
      canonical: attr('link[rel="canonical"]', "href"),
      lang: document.documentElement.getAttribute("lang"),
      ogImage: attr('meta[property="og:image"]', "content"),
      headings,
      images,
      links,
      jsonLd,
      words: text(document.body).split(" ").filter(Boolean).length,
      bytes: (nav?.transferSize ?? 0) + res.reduce((n, r) => n + (r.transferSize || 0), 0),
      lcp,
    };
  });
  const u = new URL(target.url);
  const internal = [];
  const external = [];
  for (const l of data.links) {
    let h;
    try {
      h = new URL(l.href);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(h.protocol)) continue;
    if (h.host === u.host) internal.push({ path: h.pathname, text: l.text });
    else external.push({ host: h.host, text: l.text });
  }
  return {
    label: target.label,
    // Query strings are left out: preview links carry a signed token.
    url: u.origin + u.pathname,
    path: u.pathname,
    slug: slugOf(u.pathname),
    ...data,
    links: undefined,
    internalLinks: internal,
    externalLinks: external.length,
    emptyLinks: data.links.filter((l) => !l.text).length,
  };
}

async function fetchText(url) {
  try {
    const r = await fetch(url, { redirect: "follow" });
    return { status: r.status, text: r.ok ? await r.text() : "" };
  } catch (e) {
    return { status: 0, text: "", error: e.message };
  }
}

/** Collect every page, then judge. `published` also reads the live robots.txt and sitemap. */
export async function audit(slug, { pages = [], published = false } = {}) {
  const { dir, meta } = loadProject(slug);
  const targets = parsePages(pages);
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new StudioError("Playwright is not installed. Run: npm install && npm run setup:browser. Until then, report the search audit as not done.");
  }
  const browser = await chromium.launch().catch((e) => {
    throw new StudioError(`Could not start the browser (${e.message.split("\n")[0]}). Run: npm run setup:browser`);
  });
  const collected = [];
  try {
    // Phone first: that is the page search engines index.
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
    for (const t of targets) {
      const page = await context.newPage();
      let status = 0;
      let loadError;
      try {
        const res = await page.goto(t.url, { waitUntil: "networkidle", timeout: 45_000 });
        status = res?.status() ?? 0;
      } catch (e) {
        loadError = e.message.split("\n")[0];
      }
      const p = await collect(page, t).catch((e) => ({ label: t.label, url: t.url, path: new URL(t.url).pathname, slug: slugOf(new URL(t.url).pathname), collectError: e.message.split("\n")[0] }));
      collected.push({ ...p, status, ...(loadError ? { loadError } : {}) });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  let site = null;
  if (published) {
    const origin = new URL(targets[0].url).origin;
    const robots = await fetchText(`${origin}/robots.txt`);
    const sitemap = await fetchText(`${origin}/sitemap.xml`);
    const paths = [...sitemap.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => {
      try {
        return new URL(m[1]).pathname;
      } catch {
        return m[1];
      }
    });
    // Internal links, checked on the live site (a draft's links need the preview token).
    const linkStatus = {};
    // Platform routes (checkout, cart, files) are the platform's to keep working.
    const all = [...new Set(collected.flatMap((p) => (p.internalLinks ?? []).map((l) => l.path)))].filter((path) => !PLATFORM_PATHS.test(path) || /^\/blog(\/|$)/.test(path)).slice(0, 60);
    for (const path of all) {
      let res = await fetch(origin + path, { method: "HEAD", redirect: "follow" }).catch(() => null);
      if (res?.status === 405) res = await fetch(origin + path, { redirect: "follow" }).catch(() => null);
      linkStatus[path] = res?.status ?? 0;
    }
    site = {
      origin,
      robots: { status: robots.status, blocksAll: /^\s*disallow:\s*\/\s*$/im.test(robots.text) && /user-agent:\s*\*/i.test(robots.text), sitemapListed: /sitemap:/i.test(robots.text) },
      sitemap: { status: sitemap.status, paths },
      linkStatus,
    };
  }
  const lockPath = join(dir, loadPipeline(meta.pipeline).bundle, "webto.lock.json");
  const lock = existsSync(lockPath) ? readJson(lockPath) : null;
  const report = { at: now(), published, ...(lock?.revision !== undefined ? { lockRevision: lock.revision } : {}), pages: collected, ...(site ? { site } : {}) };
  const judged = judgeAudit(report, readPlans(dir));
  writeJson(join(dir, "reports", "audit.json"), { ...report, problems: judged.problems, warnings: judged.warnings });
  return { ...report, ...judged };
}

export function readPlans(dir) {
  const read = (f) => {
    const p = join(dir, f);
    try {
      return existsSync(p) ? readJson(p) : null;
    } catch {
      return null;
    }
  };
  return { seoPlan: read("seo_plan.json"), sitePlan: read("site_plan.json") };
}

/**
 * Judge collected pages against the plans. Problems block the verify stage;
 * warnings are reported and left to judgement.
 */
export function judgeAudit(report, { seoPlan, sitePlan } = {}) {
  const problems = [];
  const warnings = [];
  const pages = report.pages ?? [];
  const planned = new Map((seoPlan?.pages ?? []).map((p) => [p.slug, p]));
  const knownSlugs = new Set([...(sitePlan?.pages ?? []).map((p) => p.slug), ...pages.map((p) => p.slug)]);

  for (const slug of (sitePlan?.pages ?? []).map((p) => p.slug)) {
    if (!pages.some((p) => p.slug === slug)) problems.push(`The page "${slug || "home"}" in site_plan.json was not audited. Pass every page with --page`);
  }

  const seen = { title: new Map(), description: new Map() };
  for (const p of pages) {
    const at = p.label;
    if (p.loadError || p.collectError || (p.status && p.status >= 400)) {
      problems.push(`${at}: did not load (${p.loadError ?? p.collectError ?? `status ${p.status}`})`);
      continue;
    }
    const plan = planned.get(p.slug);
    const title = String(p.title ?? "").trim();
    const desc = String(p.description ?? "").trim();

    if (!title) problems.push(`${at}: the page has no title. Set the page's seoTitle`);
    else if (title.length > TITLE_MAX) warnings.push(`${at}: the title is ${title.length} characters; search results cut it near ${TITLE_MAX}`);
    if (!desc) problems.push(`${at}: the page has no meta description. Set the page's seoDescription`);
    else if (desc.length < DESC_RANGE[0] || desc.length > DESC_RANGE[1]) warnings.push(`${at}: the description is ${desc.length} characters; ${DESC_RANGE[0]} to ${DESC_RANGE[1]} reads whole in a result`);
    for (const [k, v] of [["title", title], ["description", desc]]) {
      if (!v) continue;
      const other = seen[k].get(norm(v));
      if (other) problems.push(`${at}: same ${k} as ${other}. Every page gets its own`);
      else seen[k].set(norm(v), at);
    }
    if (!p.lang) problems.push(`${at}: <html> has no lang`);

    const h1s = (p.headings ?? []).filter((h) => h.level === 1);
    if (h1s.length !== 1) problems.push(`${at}: ${h1s.length} <h1> on the page${h1s.length ? ` (${h1s.map((h) => `"${h.text}"`).join(", ")})` : ""}. A page has exactly one, the hero's headline`);
    let prev = 0;
    for (const h of (p.headings ?? []).filter((x) => !x.hidden)) {
      if (prev && h.level > prev + 1) {
        warnings.push(`${at}: heading "${h.text}" is an <h${h.level}> straight after an <h${prev}>; a section heading is an <h2>, a heading inside it an <h3>`);
        break;
      }
      prev = h.level;
    }

    const noAlt = (p.images ?? []).filter((i) => i.alt === null && !i.decorative);
    if (noAlt.length) problems.push(`${at}: ${noAlt.length} image(s) without alt: ${noAlt.slice(0, 3).map((i) => i.src).join(", ")}. Describe what each shows, or alt="" for a purely decorative one`);
    const emptyAlt = (p.images ?? []).filter((i) => i.alt === "" && !i.decorative && i.width >= 200);
    if (emptyAlt.length) warnings.push(`${at}: ${emptyAlt.length} large image(s) with an empty alt, so search and screen readers skip them: ${emptyAlt.slice(0, 2).map((i) => i.src).join(", ")}. Is each really decoration?`);
    const oversized = (p.images ?? []).filter((i) => i.width > 0 && i.naturalWidth > 800 && i.naturalWidth > i.width * 2 * 2.5);
    if (oversized.length) warnings.push(`${at}: ${oversized.length} image(s) much larger than shown on a phone (e.g. ${oversized[0].naturalWidth}px for a ${oversized[0].width}px slot: ${oversized[0].src}). Pass a width to img()`);
    if (p.lcp?.lazy) warnings.push(`${at}: the largest image on the first screen (${p.lcp.src || p.lcp.tag}) is lazy-loaded, so the page shows late. Drop loading="lazy" on the hero image`);

    if (p.emptyLinks) problems.push(`${at}: ${p.emptyLinks} link(s) with no text a search engine or screen reader can read (an icon alone). Add text or aria-label`);
    const generic = (p.internalLinks ?? []).filter((l) => GENERIC_ANCHORS.test(l.text.trim()));
    if (generic.length) warnings.push(`${at}: link text "${generic[0].text}" says nothing about where it goes`);

    if (p.jsonLd?.errors?.length) problems.push(`${at}: structured data that does not parse: ${p.jsonLd.errors[0]}. A variant must not write its own JSON-LD; the platform does`);
    if (!p.ogImage) warnings.push(`${at}: no og:image, so a shared link has no picture. Set businessProfile.logoUrl`);
    if (p.words < THIN_WORDS) warnings.push(`${at}: only ${p.words} words of text. A page this thin rarely ranks; say more of what the brief supports, or merge it into another page`);
    if (p.bytes > HEAVY_BYTES) warnings.push(`${at}: ${(p.bytes / 1048576).toFixed(1)} MB loaded on a phone. Shrink the largest images or video`);

    if (sitePlan && !report.published) {
      const broken = [...new Set((p.internalLinks ?? []).map((l) => l.path))].filter((path) => !PLATFORM_PATHS.test(path) && !knownSlugs.has(slugOf(path)));
      if (broken.length) problems.push(`${at}: links to ${broken.slice(0, 4).join(", ")}, which no page of this site has`);
    }
    if (report.published && report.site) {
      const dead = [...new Set((p.internalLinks ?? []).map((l) => l.path))].filter((path) => (report.site.linkStatus?.[path] ?? 200) >= 400);
      if (dead.length) problems.push(`${at}: links to ${dead.slice(0, 4).join(", ")}, which answer with an error`);
      if (/noindex/i.test(p.robots ?? "")) problems.push(`${at}: the public page says noindex, so search engines drop it. Is the site published?`);
      if (p.canonical) {
        try {
          if (new URL(p.canonical).host !== new URL(p.url).host) warnings.push(`${at}: the canonical link points at ${new URL(p.canonical).host}. Audit that address instead: it is the one search engines keep`);
        } catch {}
      } else problems.push(`${at}: the public page has no canonical link`);
      if (report.site.sitemap?.paths && !report.site.sitemap.paths.includes(p.path)) warnings.push(`${at}: ${p.path} is not in sitemap.xml yet`);
    }

    if (plan) {
      if (norm(title) !== norm(plan.title)) problems.push(`${at}: the title is "${title}", seo_plan.json says "${plan.title}". Make them the same, in the bundle or in the plan`);
      if (norm(desc) !== norm(plan.description)) problems.push(`${at}: the description differs from seo_plan.json. Make them the same, in the bundle or in the plan`);
      const h1 = h1s[0]?.text ?? "";
      if (h1 && plan.h1 && norm(h1) !== norm(plan.h1)) warnings.push(`${at}: the <h1> reads "${h1}", seo_plan.json planned "${plan.h1}"`);
      const terms = new Set([...words(plan.query), ...words(seoPlan?.searcher?.place)]);
      if (h1 && terms.size && !words(`${h1} ${title}`).some((w) => terms.has(w))) {
        warnings.push(`${at}: neither the title nor the <h1> uses a word of "${plan.query}"`);
      }
    }
  }

  const home = pages.find((p) => p.slug === "");
  if (home?.jsonLd && seoPlan?.searcher?.place && !home.jsonLd.org?.address) {
    warnings.push("home: the structured data has no address, so local search cannot place the business. Fill businessProfile.address from the brief");
  }
  if (report.published && report.site) {
    if (report.site.robots.blocksAll) problems.push(`robots.txt on ${report.site.origin} blocks every crawler`);
    if (report.site.sitemap.status !== 200) problems.push(`sitemap.xml on ${report.site.origin} answered ${report.site.sitemap.status}`);
  } else if (pages.some((p) => /noindex/i.test(p.robots ?? ""))) {
    warnings.push("The draft pages say noindex, as a draft should. After publishing, run the audit again with --published on the public address");
  }
  return { problems: [...new Set(problems)], warnings: [...new Set(warnings)] };
}

/** For the checkpoint: judge the saved audit again against the plans as they are now. */
export function judgeSavedAudit(dir, pipeline) {
  const path = join(dir, "reports", "audit.json");
  if (!existsSync(path)) return { problems: ['No search audit yet. Run "studio audit <project> --page home=<url> ..." on every page of the draft'] };
  let report;
  try {
    report = readJson(path);
  } catch (e) {
    return { problems: [e.message] };
  }
  const problems = [];
  const lockPath = join(dir, pipeline.bundle, "webto.lock.json");
  const lock = existsSync(lockPath) ? readJson(lockPath) : null;
  if (lock?.revision !== undefined && report.lockRevision !== undefined && lock.revision !== report.lockRevision) {
    problems.push(`reports/audit.json: the draft changed after the audit (revision ${report.lockRevision}, now ${lock.revision}). Run the audit again`);
  }
  const judged = judgeAudit(report, readPlans(dir));
  return { problems: [...problems, ...judged.problems.map((p) => `audit: ${p}`)], warnings: judged.warnings };
}
