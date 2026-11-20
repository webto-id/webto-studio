// Motion on the real pages: what a screenshot cannot show. The page is scrolled
// the way a visitor scrolls it, on a phone with its processor slowed to a
// mid-range Android's and on a laptop, and measured: frames that stall, layout
// that jumps, canvases that stay empty, entrance effects that never run, pins
// too long for a thumb, heavy models and video. At each section that moves it
// also keeps two frames, as it enters and once it has settled, so the critic
// can judge the motion instead of leaving it out.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { StudioError, now, readJson, walk, writeJson } from "./core.mjs";
import { loadPipeline, loadProject } from "./pipelines.mjs";
import { openPage, parsePages, watchConsole } from "./shoot.mjs";

export const MOTION_WIDTHS = [390, 1280];
// A mid-range Android runs page script about four times slower than a laptop.
const CPU_SLOWDOWN = (width) => (width < 600 ? 4 : 1);
const VIEW = (width) => ({ width, height: width < 600 ? 844 : 800 });
const SETTLE_MS = 700;
const MAX_FRAMES = 6;
// Thresholds. Measured on the slowed phone; a laptop that stutters is a fault outright.
export const LIMITS = {
  droppedPct: 20, // share of frames slower than 50 ms while scrolling
  blockingMs: 600, // main-thread time past 50 ms per task, while scrolling
  layoutShift: 0.1, // the same bar as Core Web Vitals' CLS
  pinScreens: 3, // a pin longer than three phone screens feels stuck
  modelBytes: 3 * 1024 * 1024, // 1 to 3 MB loads well on a phone
  videoBytes: 8 * 1024 * 1024,
};
// The libraries that make a section move (wvf.md §4a, webgl.md, webto-3d-effects).
const MOVING_LIBS = /data-uses\s*=\s*["'][^"']*\b(gsap|scroll-trigger|ogl|three|lenis)\b/i;

/** Whether this project must have a motion report before verify: a 3D landing page, or any section that loads a motion library. */
export function motionRequired(dir, pipeline) {
  if (pipeline.name === "landing-3d") return true;
  const bundle = join(dir, pipeline.bundle);
  if (!existsSync(bundle)) return false;
  return walk(bundle).some((f) => f.endsWith(".astro") && MOVING_LIBS.test(readFileSync(f, "utf8")));
}

// Runs in the page before its own scripts: long tasks and layout shifts as they happen.
function initObservers() {
  window.__wm = { longTasks: [], shift: 0 };
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__wm.longTasks.push(e.duration))).observe({ type: "longtask", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__wm.shift += e.value))).observe({ type: "layout-shift", buffered: true });
  } catch {}
}

// Entrance effects still waiting to run (the platform's data-wv-effect runtime marks a run one .wv-in).
function waitingEffects() {
  return [...document.querySelectorAll("[data-wv-effect]")].filter(
    (e) => !e.classList.contains("wv-in") && !(e.dataset.wvEffect === "stagger" && e.children.length && [...e.children].every((k) => k.classList.contains("wv-in"))),
  ).length;
}

async function open(browser, url, width, reducedMotion, sink) {
  const context = await browser.newContext({ viewport: VIEW(width), deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600, reducedMotion: reducedMotion ? "reduce" : "no-preference" });
  await context.addInitScript(initObservers);
  const page = await context.newPage();
  watchConsole(page, url, sink.errors, sink.other);
  page.on("response", async (r) => {
    const u = r.url().split("?")[0].toLowerCase();
    const type = r.headers()["content-type"] ?? "";
    const kind = u.endsWith(".glb") || u.endsWith(".gltf") || type.includes("model/gltf") ? "model" : type.startsWith("video/") || /\.(mp4|webm)$/.test(u) ? "video" : null;
    if (!kind) return;
    const bytes = Number(r.headers()["content-length"]) || (await r.body().then((b) => b.length, () => 0));
    sink.media.push({ kind, url: r.url().split("?")[0].slice(0, 200), bytes });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN(width) });
  const loadError = await openPage(page, url);
  return { context, page, loadError };
}

/** Scroll top to bottom at a reader's pace while counting frames, long tasks, shifts and sideways overflow. */
async function measureScroll(page, width) {
  await page.evaluate(() => {
    window.__wm.longTasks = [];
    window.__wm.shift = 0;
    window.__wm.frames = [];
    window.__wm.rec = true;
    let last = performance.now();
    const tick = (t) => {
      if (!window.__wm.rec) return;
      window.__wm.frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(VIEW(width).width / 2, VIEW(width).height / 2);
  const overflowAt = [];
  for (let i = 0; i < 400; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(60);
    if (i % 5 === 0) {
      const s = await page.evaluate(() => ({ y: Math.round(scrollY), over: document.documentElement.scrollWidth - document.documentElement.clientWidth, end: scrollY + innerHeight >= document.documentElement.scrollHeight - 2 }));
      if (s.over > 1) overflowAt.push({ y: s.y, px: s.over });
      if (s.end) break;
    }
  }
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    window.__wm.rec = false;
    const f = window.__wm.frames.slice(2);
    const sorted = [...f].sort((a, b) => a - b);
    return {
      frames: f.length,
      droppedPct: f.length ? Math.round((f.filter((d) => d > 50).length / f.length) * 1000) / 10 : 0,
      p95Ms: sorted.length ? Math.round(sorted[Math.floor(sorted.length * 0.95)]) : 0,
      longTasks: window.__wm.longTasks.length,
      blockingMs: Math.round(window.__wm.longTasks.reduce((s, d) => s + Math.max(0, d - 50), 0)),
      layoutShift: Math.round(window.__wm.shift * 1000) / 1000,
    };
  });
  return { ...m, overflowAt: overflowAt.slice(0, 5) };
}

/** Where the moving sections are: elements that load a motion library, entrance effects, and each pin's start, middle and end. */
async function movingPositions(page, max) {
  return page.evaluate((max) => {
    const vh = innerHeight;
    const top = (el) => el.getBoundingClientRect().top + scrollY;
    const ys = [];
    const sections = new Set();
    for (const el of document.querySelectorAll("[data-uses], [data-wv-effect], canvas, video")) {
      const s = el.closest("section") ?? el;
      if (!sections.has(s)) {
        sections.add(s);
        ys.push({ y: Math.max(0, top(s) - vh * 0.2), why: el.matches("canvas") ? "canvas" : el.matches("video") ? "video" : el.dataset.uses ? `uses ${el.dataset.uses}` : "entrance" });
      }
    }
    const pins = [];
    for (const sp of document.querySelectorAll(".pin-spacer")) {
      const t = top(sp);
      const h = sp.getBoundingClientRect().height;
      pins.push({ y: Math.round(t), screens: Math.round((h / vh) * 10) / 10 });
      for (const f of [0.15, 0.5, 0.85]) ys.push({ y: t + (h - vh) * f, why: "pinned" });
    }
    ys.sort((a, b) => a.y - b.y);
    const picked = [];
    for (const p of ys) if (!picked.length || p.y - picked.at(-1).y > vh * 0.5) picked.push({ y: Math.round(p.y), why: p.why });
    // Spread the picks over the page when there are more than the frames allowed.
    const step = picked.length / max;
    const out = picked.length <= max ? picked : Array.from({ length: max }, (_, i) => picked[Math.floor(i * step)]);
    return { positions: out, pins };
  }, max);
}

/** A canvas whose pixels are all one colour drew nothing. Needs sharp; without it the check is skipped. */
async function blankCanvases(page, sharp) {
  if (!sharp) return null;
  const handles = await page.$$("canvas");
  const out = [];
  for (const [i, h] of handles.entries()) {
    const box = await h.boundingBox().catch(() => null);
    if (!box || box.width * box.height < 10_000) continue;
    const visible = await h.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden" && Number(getComputedStyle(el).opacity) > 0.05;
    });
    if (!visible) continue;
    const buf = await h.screenshot({ animations: "allow" }).catch(() => null);
    if (!buf) continue;
    const stats = await sharp(buf).stats().catch(() => null);
    if (!stats) continue;
    const spread = Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev));
    out.push({ index: i, width: Math.round(box.width), height: Math.round(box.height), blank: spread < 2 });
  }
  return out;
}

/** Judge one report. Pure: the checkpoint calls it again on the saved file. */
export function judgeMotion(report) {
  const problems = [];
  const warnings = [];
  for (const r of report.runs ?? []) {
    const at = `${r.label} @${r.width}${r.reducedMotion ? " reduced motion" : ""}`;
    if (r.loadError) problems.push(`${at}: did not load (${r.loadError})`);
    for (const e of r.consoleErrors ?? []) problems.push(`${at}: console error while scrolling: ${e}`);
    for (const o of r.scroll?.overflowAt ?? []) problems.push(`${at}: scrolls sideways by ${o.px}px at ${o.y}px down (a pin or a moving element wider than the screen)`);
    if (r.neverRevealed > 0) problems.push(`${at}: ${r.neverRevealed} entrance effect(s) never ran, even scrolled to the middle of the screen; their content stays invisible`);
    for (const c of r.canvases ?? []) if (c.blank) problems.push(`${at}: canvas ${c.index} (${c.width}x${c.height}) is on screen and drew nothing`);
    const phone = r.width < 600;
    const s = r.scroll ?? {};
    if (s.droppedPct > LIMITS.droppedPct) (phone ? warnings : problems).push(`${at}: ${s.droppedPct}% of frames took over 50 ms while scrolling${phone ? " on a slowed phone" : ""}. Lighten the scroll-driven work`);
    if (s.blockingMs > LIMITS.blockingMs) warnings.push(`${at}: ${s.blockingMs} ms of blocked main thread while scrolling (${s.longTasks} long tasks)`);
    if (s.layoutShift > LIMITS.layoutShift) warnings.push(`${at}: layout shifted by ${s.layoutShift} while scrolling (above ${LIMITS.layoutShift}); something changes size as it enters`);
    for (const p of r.pins ?? []) if (phone && p.screens > LIMITS.pinScreens) warnings.push(`${at}: a section is pinned for ${p.screens} screens at ${p.y}px; on a phone more than ${LIMITS.pinScreens} feels stuck`);
    if (phone) {
      const model = (r.media ?? []).filter((m) => m.kind === "model").reduce((a, m) => a + m.bytes, 0);
      const video = (r.media ?? []).filter((m) => m.kind === "video").reduce((a, m) => a + m.bytes, 0);
      if (model > LIMITS.modelBytes) warnings.push(`${at}: ${(model / 1048576).toFixed(1)} MB of 3D model on a phone; 1 to 3 MB loads well`);
      if (video > LIMITS.videoBytes) warnings.push(`${at}: ${(video / 1048576).toFixed(1)} MB of video on a phone`);
    }
  }
  return { problems: [...new Set(problems)], warnings: [...new Set(warnings)] };
}

/** The checkpoint's view of the saved report: present when required, about the current draft, and judged again. */
export function judgeSavedMotion(dir, pipeline) {
  const path = join(dir, "motion", "index.json");
  if (!existsSync(path)) {
    return motionRequired(dir, pipeline)
      ? { problems: ['This site moves (a motion library or a 3D page), and nothing has checked how. Run "studio motion <project> --page home=<url> ..." on the draft'] }
      : { problems: [], warnings: [] };
  }
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
    problems.push(`motion/index.json: the draft changed after it was measured (revision ${report.lockRevision}, now ${lock.revision}). Run "studio motion" again`);
  }
  const judged = judgeMotion(report);
  return { problems: [...problems, ...judged.problems.map((p) => `motion: ${p}`)], warnings: judged.warnings.map((w) => `motion: ${w}`) };
}

export async function motion(slug, { pages = [], widths, reducedMotion = false, frames = MAX_FRAMES } = {}) {
  const { dir, meta } = loadProject(slug);
  const targets = parsePages(pages, []);
  const sizes = widths?.length ? widths : MOTION_WIDTHS;
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new StudioError("Playwright is not installed. Run: npm install && npm run setup:browser");
  }
  const sharp = await import("sharp").then((m) => m.default, () => null);
  const browser = await chromium.launch().catch((e) => {
    throw new StudioError(`Could not start the browser (${e.message.split("\n")[0]}). Run: npm run setup:browser`);
  });
  const outDir = join(dir, "motion");
  mkdirSync(outDir, { recursive: true });
  const runs = [];
  try {
    for (const target of targets) {
      for (const width of sizes) {
        const base = `${target.label}-${width}${reducedMotion ? "-still" : ""}`;
        for (const f of readdirSync(outDir).filter((f) => f.startsWith(`${base}-`) && /^-\d+-(enter|settled)\.jpg$/.test(f.slice(base.length)))) rmSync(join(outDir, f));
        const sink = { errors: [], other: [], media: [] };
        // First visit: measure the scroll, untouched by screenshots.
        const a = await open(browser, target.url, width, reducedMotion, sink);
        const scroll = a.loadError ? null : await measureScroll(a.page, width);
        await a.context.close();
        // Second visit: frames at each moving section, as it enters and once settled.
        const b = await open(browser, target.url, width, reducedMotion, { errors: sink.errors, other: sink.other, media: [] });
        const { positions, pins } = b.loadError ? { positions: [], pins: [] } : await movingPositions(b.page, Math.max(1, Math.min(12, frames)));
        const shots = [];
        const canvases = new Map();
        for (const [i, p] of positions.entries()) {
          await b.page.evaluate((y) => window.scrollTo(0, y), p.y);
          const enter = `${base}-${i + 1}-enter.jpg`;
          const settled = `${base}-${i + 1}-settled.jpg`;
          const okA = await b.page.screenshot({ path: join(outDir, enter), type: "jpeg", quality: 70, animations: "allow" }).then(() => true, () => false);
          await b.page.waitForTimeout(SETTLE_MS);
          const okB = await b.page.screenshot({ path: join(outDir, settled), type: "jpeg", quality: 70, animations: "allow" }).then(() => true, () => false);
          for (const c of (await blankCanvases(b.page, sharp)) ?? []) if (!canvases.has(c.index) || canvases.get(c.index).blank) canvases.set(c.index, c);
          shots.push({ y: p.y, why: p.why, ...(okA ? { enter: `motion/${enter}` } : {}), ...(okB ? { settled: `motion/${settled}` } : {}) });
        }
        // Anything still waiting is brought to the middle of the screen; what stays hidden there never runs.
        let neverRevealed = 0;
        if (!b.loadError) {
          neverRevealed = await b.page.evaluate(async (ms) => {
            const wait = (t) => new Promise((r) => setTimeout(r, t));
            const isWaiting = (e) => !e.classList.contains("wv-in") && !(e.dataset.wvEffect === "stagger" && e.children.length && [...e.children].every((k) => k.classList.contains("wv-in")));
            for (const el of [...document.querySelectorAll("[data-wv-effect]")].filter(isWaiting).slice(0, 40)) {
              el.scrollIntoView({ block: "center" });
              await wait(ms);
            }
            // The platform hides an effect only while its runtime is on (html.wv-js); count what is still invisible.
            if (!document.documentElement.classList.contains("wv-js")) return 0;
            return [...document.querySelectorAll("[data-wv-effect]")].filter((e) => isWaiting(e) && Number(getComputedStyle(e).opacity) < 0.1).length;
          }, 600);
        }
        await b.context.close();
        runs.push({
          label: target.label,
          page: (() => {
            const u = new URL(target.url);
            return u.origin + u.pathname;
          })(),
          width,
          cpuSlowdown: CPU_SLOWDOWN(width),
          reducedMotion,
          ...(scroll ? { scroll } : {}),
          pins,
          frames: shots,
          ...(sharp ? { canvases: [...canvases.values()] } : { canvasesNotChecked: "sharp is not installed" }),
          neverRevealed,
          media: sink.media,
          consoleErrors: [...new Set(sink.errors)].slice(0, 10),
          ...(sink.other.length ? { otherConsole: [...new Set(sink.other)].slice(0, 10) } : {}),
          ...(a.loadError || b.loadError ? { loadError: a.loadError || b.loadError } : {}),
        });
      }
    }
  } finally {
    await browser.close();
  }
  // A later run (reduced motion, another page) adds to the report instead of replacing it.
  const indexPath = join(outDir, "index.json");
  const key = (r) => `${r.label}|${r.width}|${r.reducedMotion}`;
  const taken = new Set(runs.map(key));
  const earlier = existsSync(indexPath) ? (JSON.parse(readFileSync(indexPath, "utf8")).runs ?? []).filter((r) => !taken.has(key(r))) : [];
  const lockPath = join(dir, loadPipeline(meta.pipeline).bundle, "webto.lock.json");
  const lock = existsSync(lockPath) ? readJson(lockPath) : null;
  const report = { at: now(), ...(lock?.revision !== undefined ? { lockRevision: lock.revision } : {}), runs: [...earlier, ...runs] };
  const judged = judgeMotion(report);
  writeJson(indexPath, { ...report, ...judged });
  return { ...report, ...judged };
}
