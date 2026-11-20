// Screenshots of real pages at phone, tablet and desktop width, plus the
// three things a screenshot alone does not prove: sideways overflow, images
// that failed to load, and errors in the console.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { StudioError, now, writeJson } from "./core.mjs";
import { loadProject } from "./pipelines.mjs";

const DEFAULT_WIDTHS = [390, 768, 1280];
const VIEW_HEIGHT = 900;
const MAX_PARTS = 12;

export function parsePages(pages, urls) {
  const out = [];
  for (const p of pages) {
    const i = p.indexOf("=");
    if (i < 1) throw new StudioError(`--page takes label=url, got "${p}"`);
    out.push({ label: p.slice(0, i), url: p.slice(i + 1) });
  }
  for (const url of urls) out.push({ label: `page-${out.length + 1}`, url });
  for (const p of out) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.label)) throw new StudioError(`Label "${p.label}" must be lowercase words joined by hyphens`);
    if (!/^(https?|file):\/\//.test(p.url)) throw new StudioError(`Not a URL: ${p.url}`);
  }
  if (!out.length) throw new StudioError('Nothing to capture. Pass --page home=<url> (repeatable) or --url <url>');
  return out;
}

export async function shoot(slug, { pages = [], urls = [], widths, dark = false, reducedMotion = false, tag } = {}) {
  const { dir } = loadProject(slug);
  const targets = parsePages(pages, urls);
  const sizes = widths?.length ? widths : DEFAULT_WIDTHS;
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new StudioError("Playwright is not installed. Run: npm install && npm run setup:browser. Until then, report visual checks as not done.");
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    throw new StudioError(`Could not start the browser (${e.message.split("\n")[0]}). Run: npm run setup:browser`);
  }
  const outDir = join(dir, "shots");
  mkdirSync(outDir, { recursive: true });
  const suffix = [dark ? "dark" : null, reducedMotion ? "still" : null, tag].filter(Boolean).join("-");
  const shots = [];
  try {
    for (const target of targets) {
      for (const width of sizes) {
        const context = await browser.newContext({
          viewport: { width, height: VIEW_HEIGHT },
          colorScheme: dark ? "dark" : "light",
          reducedMotion: reducedMotion ? "reduce" : "no-preference",
        });
        const page = await context.newPage();
        const consoleErrors = [];
        page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 300)));
        page.on("pageerror", (e) => consoleErrors.push(String(e.message).slice(0, 300)));
        let loadError = null;
        try {
          await page.goto(target.url, { waitUntil: "networkidle", timeout: 45_000 });
        } catch (e) {
          loadError = e.message.split("\n")[0];
        }
        // Walk down the page at a reader's pace so lazy images load and entrance
        // effects run. A quick walk leaves reveals below hidden (their observer
        // fires after the page has moved on), and the capture then shows empty
        // sections no visitor sees. An effect still waiting is brought to the
        // middle of the screen, as a visitor reading down would bring it; one
        // that stays hidden there is a real fault and is photographed as such.
        await page.evaluate(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await wait(350);
          }
          const waiting = () =>
            [...document.querySelectorAll("[data-wv-effect]")].filter(
              (e) => !e.classList.contains("wv-in") && !(e.dataset.wvEffect === "stagger" && e.children.length && [...e.children].every((k) => k.classList.contains("wv-in"))),
            );
          for (const el of waiting().slice(0, 40)) {
            el.scrollIntoView({ block: "center" });
            await wait(500);
          }
          window.scrollTo(0, 0);
        }).catch(() => {});
        await page.waitForTimeout(1200);
        const measured = await page.evaluate(() => {
          const doc = document.documentElement;
          return {
            overflowPx: Math.max(0, doc.scrollWidth - doc.clientWidth),
            brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc.slice(0, 200)),
            title: document.title,
          };
        }).catch(() => ({ overflowPx: null, brokenImages: [], title: "" }));
        const base = `${target.label}-${width}${suffix ? `-${suffix}` : ""}`;
        const file = `${base}.png`;
        const fold = `${base}-fold.png`;
        // Transitions are run to their end before each capture: a crossfade caught
        // halfway shows two phrases on top of each other, which no visitor sees.
        // The first screen on its own: what a visitor sees before scrolling, at real size,
        // with everything that floats over it.
        const foldOk = await page.screenshot({ path: join(outDir, fold), fullPage: false, animations: "disabled" }).then(() => true, () => false);
        // What stays fixed on the screen (a WhatsApp button, a sticky bar, the platform's
        // badge) would be drawn wherever the capture happened to leave it, over content
        // it never covers for a visitor. The fold shows it; the rest leaves it out.
        await page
          .evaluate(() => {
            // A fixed backdrop (a full-screen canvas or image behind the page) is part of
            // the look and stays; only what floats over a part of the screen goes.
            const screen = innerWidth * innerHeight;
            for (const el of document.querySelectorAll("body *")) {
              if (getComputedStyle(el).position !== "fixed") continue;
              const r = el.getBoundingClientRect();
              if (r.width * r.height < screen * 0.3) el.style.setProperty("visibility", "hidden", "important");
            }
          })
          .catch(() => {});
        await page.screenshot({ path: join(outDir, file), fullPage: true, animations: "disabled" }).catch((e) => (loadError ??= e.message.split("\n")[0]));
        // A long page shrunk into one image cannot be read, so it is also cut into
        // parts a reader can open at real size.
        const parts = [];
        // Parts left by an earlier capture of this page would sit beside the new ones.
        for (const old of readdirSync(outDir).filter((f) => f.startsWith(`${base}-part-`) && /^-part-\d+\.png$/.test(f.slice(base.length)))) rmSync(join(outDir, old));
        const height = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 0);
        // Parts grow on a very long page, so the whole page is always covered.
        const seg = Math.max(Math.round(VIEW_HEIGHT * 1.5), Math.ceil(height / MAX_PARTS));
        if (height > VIEW_HEIGHT * 2) {
          for (let y = 0, i = 1; y < height; y += seg, i++) {
            const part = `${base}-part-${i}.png`;
            const ok = await page
              .screenshot({ path: join(outDir, part), fullPage: true, animations: "disabled", clip: { x: 0, y, width, height: Math.min(seg, height - y) } })
              .then(() => true, () => false);
            if (ok) parts.push(`shots/${part}`);
          }
        }
        const u = new URL(target.url);
        shots.push({
          label: target.label,
          // Query strings are left out: preview links carry a signed token.
          page: u.protocol === "file:" ? u.pathname.split("/").pop() : u.origin + u.pathname,
          ...(u.protocol === "file:" ? { local: true } : {}),
          width,
          scheme: dark ? "dark" : "light",
          reducedMotion,
          ...(tag ? { tag } : {}),
          file: `shots/${file}`,
          ...(foldOk ? { fold: `shots/${fold}` } : {}),
          ...(parts.length ? { parts } : {}),
          ...measured,
          consoleErrors: [...new Set(consoleErrors)].slice(0, 10),
          ...(loadError ? { loadError } : {}),
        });
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  // A later run (dark, reduced motion) adds to the index instead of replacing it.
  const indexPath = join(outDir, "index.json");
  const taken = new Set(shots.map((s) => s.file));
  const earlier = existsSync(indexPath) ? (JSON.parse(readFileSync(indexPath, "utf8")).shots ?? []).filter((s) => !taken.has(s.file)) : [];
  shots.unshift(...earlier);
  const problems = shots.flatMap((s) => [
    ...(s.loadError ? [`${s.label} @${s.width}: did not load (${s.loadError})`] : []),
    ...(s.overflowPx > 1 ? [`${s.label} @${s.width}: scrolls sideways by ${s.overflowPx}px`] : []),
    ...s.brokenImages.map((src) => `${s.label} @${s.width}: image failed to load: ${src}`),
    ...s.consoleErrors.map((e) => `${s.label} @${s.width}: console error: ${e}`),
  ]);
  const index = { at: now(), shots, problems: [...new Set(problems)] };
  writeJson(indexPath, index);
  return index;
}
