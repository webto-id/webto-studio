// Reads an existing website into a content inventory: pages, headings, text,
// images, navigation and contact details. Plain fetch by default; pass
// render=true for sites that build their pages in the browser.
import { join } from "node:path";
import { StudioError, now, writeJson } from "./core.mjs";
import { loadProject } from "./pipelines.mjs";

const UA = "webto-studio-crawl/0.1 (site migration, run by the site owner's agent)";
const SKIP_EXT = /\.(jpe?g|png|gif|webp|svg|ico|pdf|zip|rar|mp4|mp3|webm|css|js|json|xml|woff2?|ttf|docx?|xlsx?|pptx?)(\?|$)/i;
const SKIP_PATH = /\/(wp-admin|wp-login|wp-json|feed|cart|checkout|my-account|login|logout|tag|author)(\/|$)|[?&](replytocom|add-to-cart|s)=/i;
const SOCIAL_HOSTS = new Set(["facebook.com", "instagram.com", "tiktok.com", "youtube.com", "linkedin.com", "twitter.com", "x.com", "threads.net", "t.me"]);
const isSocial = (href) => {
  try {
    return SOCIAL_HOSTS.has(new URL(href).hostname.replace(/^(www|m)\./, ""));
  } catch {
    return false;
  }
};

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", hellip: "...", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', copy: "(c)" };

export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const text = (html) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const attr = (tag, name) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(1).find((v) => v !== undefined);

function absolute(href, base) {
  try {
    const u = new URL(decodeEntities(href.trim()), base);
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

/** Pure: one HTML document in, one inventory page out. */
export function extractPage(html, url) {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ");
  const base = new URL(url);
  const title = text(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(cleaned)?.[1] ?? "");
  const metaTag = /<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*>/i.exec(cleaned)?.[0];
  const description = metaTag ? decodeEntities(attr(metaTag, "content") ?? "") : "";

  const headings = [...cleaned.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => ({ level: Number(m[1]), text: text(m[2]) }))
    .filter((h) => h.text);

  const seen = new Set();
  const text_blocks = [];
  for (const m of cleaned.matchAll(/<(p|li|blockquote|td|dd)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = text(m[2]);
    if (t.length < 25 || seen.has(t)) continue;
    seen.add(t);
    text_blocks.push(t);
    if (text_blocks.length >= 120) break;
  }

  const images = [];
  const seenImg = new Set();
  for (const m of cleaned.matchAll(/<img\b[^>]*>/gi)) {
    const src = attr(m[0], "src") ?? attr(m[0], "data-src");
    if (!src || src.startsWith("data:")) continue;
    const u = absolute(src, base);
    if (!u || seenImg.has(u.href)) continue;
    seenImg.add(u.href);
    images.push({ src: u.href, alt: decodeEntities(attr(m[0], "alt") ?? ""), rights: "unknown" });
    if (images.length >= 80) break;
  }

  const links = new Set();
  const contacts = { phones: new Set(), emails: new Set(), whatsapp: new Set(), social: new Set() };
  const anchors = [];
  for (const m of cleaned.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(m[1], "href");
    if (!href) continue;
    const raw = decodeEntities(href.trim());
    if (/^tel:/i.test(raw)) contacts.phones.add(raw.slice(4).replace(/\s+/g, ""));
    else if (/^mailto:/i.test(raw)) contacts.emails.add(raw.slice(7).split("?")[0]);
    else if (/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/i.test(raw)) contacts.whatsapp.add(raw);
    else if (isSocial(raw)) contacts.social.add(raw);
    const u = absolute(raw, base);
    if (!u || !/^https?:$/.test(u.protocol)) continue;
    anchors.push({ label: text(m[2]), href: u.href, index: m.index });
    if (u.hostname === base.hostname && !SKIP_EXT.test(u.pathname) && !SKIP_PATH.test(u.pathname + u.search)) {
      u.search = "";
      links.add(u.href);
    }
  }

  // Navigation: the anchors inside the first <nav>, or failing that <header>.
  const navBlock = /<nav\b[\s\S]*?<\/nav>/i.exec(cleaned) ?? /<header\b[\s\S]*?<\/header>/i.exec(cleaned);
  const nav = navBlock
    ? anchors.filter((a) => a.index >= navBlock.index && a.index < navBlock.index + navBlock[0].length && a.label).map(({ label, href }) => ({ label, href }))
    : [];

  return {
    page: { url, path: base.pathname, title, description, headings, text_blocks, images, links: [...links] },
    nav,
    contacts: Object.fromEntries(Object.entries(contacts).map(([k, v]) => [k, [...v]])),
  };
}

export function parseRobots(txt) {
  const disallow = [];
  let applies = false;
  for (const line of txt.split(/\r?\n/)) {
    const m = /^\s*([a-z-]+)\s*:\s*(.*?)\s*(#.*)?$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === "user-agent") applies = m[2] === "*";
    else if (key === "disallow" && applies && m[2]) disallow.push(m[2]);
  }
  return disallow;
}

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.5" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
  const type = res.headers.get("content-type") ?? "";
  const body = res.ok && /text\/html|application\/xhtml|text\/plain/i.test(type) ? (await res.text()).slice(0, 2_000_000) : "";
  return { status: res.status, finalUrl: res.url, type, body };
}

export async function crawl(slug, startUrl, { max = 20, authorized = false, render = false } = {}) {
  if (!authorized) {
    throw new StudioError("Ask the user first: are they (or their client) the owner of this site, and may its content be reused? On a yes, run again with --authorized.");
  }
  const { dir } = loadProject(slug);
  const start = absolute(startUrl, undefined);
  if (!start || !/^https?:$/.test(start.protocol)) throw new StudioError(`Not a web address: ${startUrl}`);
  const limit = Math.min(Math.max(1, Number(max) || 20), 60);

  let disallow = [];
  try {
    const robots = await get(new URL("/robots.txt", start).href);
    if (robots.status === 200) disallow = parseRobots(robots.body);
  } catch {}

  let browser = null;
  if (render) {
    try {
      const { chromium } = await import("playwright");
      browser = await chromium.launch();
    } catch {
      throw new StudioError("--render needs Playwright. Run: npm install && npm run setup:browser");
    }
  }

  const queue = [start.href];
  const visited = new Set();
  const pages = [];
  const skipped = [];
  let nav = [];
  const contacts = { phones: new Set(), emails: new Set(), whatsapp: new Set(), social: new Set() };
  try {
    while (queue.length && pages.length < limit) {
      const url = queue.shift();
      const key = url.replace(/\/$/, "");
      if (visited.has(key)) continue;
      visited.add(key);
      const path = new URL(url).pathname;
      if (disallow.some((d) => path.startsWith(d))) {
        skipped.push({ url, reason: "robots.txt" });
        continue;
      }
      let html = "";
      let status = 0;
      try {
        if (browser) {
          const page = await browser.newPage({ userAgent: UA });
          const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => null);
          status = res?.status() ?? 0;
          html = await page.content();
          await page.close();
        } else {
          const res = await get(url);
          status = res.status;
          html = res.body;
          if (new URL(res.finalUrl).hostname !== start.hostname) {
            skipped.push({ url, reason: `redirects to another host (${new URL(res.finalUrl).hostname})` });
            continue;
          }
        }
      } catch (e) {
        skipped.push({ url, reason: e.message.split("\n")[0] });
        continue;
      }
      if (!html) {
        skipped.push({ url, reason: `no HTML (status ${status})` });
        continue;
      }
      const got = extractPage(html, url);
      pages.push({ ...got.page, status });
      if (!nav.length) nav = got.nav;
      for (const k of Object.keys(contacts)) for (const v of got.contacts[k]) contacts[k].add(v);
      for (const link of got.page.links) if (!visited.has(link.replace(/\/$/, ""))) queue.push(link);
      await new Promise((r) => setTimeout(r, 300));
    }
  } finally {
    await browser?.close();
  }
  if (!pages.length) throw new StudioError(`Nothing could be read from ${start.href}. ${skipped[0] ? `First problem: ${skipped[0].reason}.` : ""} A site that builds its pages in the browser needs --render.`);

  const thin = pages.filter((p) => p.text_blocks.length === 0 && p.headings.length === 0).length;
  const inventory = {
    source_url: start.href,
    crawled_at: now(),
    authorized_by_user: true,
    rendered: Boolean(browser),
    pages,
    nav,
    contacts: Object.fromEntries(Object.entries(contacts).map(([k, v]) => [k, [...v]])),
    skipped,
    not_carried: [],
  };
  writeJson(join(dir, "content_inventory.json"), inventory);
  return { inventory, thin, leftInQueue: queue.length };
}
