// Category playbooks: what visitors of one kind of business come to do, what
// decides it for them, what the trade may not claim, and where its concepts
// come from. A playbook never prescribes a look; the concept still does that.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { ROOT, StudioError, loadConfig } from "./core.mjs";

export const PLAYBOOK_DIR = join(ROOT, "skills", "playbooks");

// The marketplace's own categories (html-to-webto-template references/manifest.md).
export const LISTING_CATEGORIES = [
  "Bisnis & Jasa", "Toko Online", "Kuliner", "Portofolio & Agency", "Pendidikan & Kursus", "Kesehatan & Kecantikan",
  "Properti & Konstruksi", "Travel & Wisata", "Event & Wedding", "Profil Personal", "Komunitas & Organisasi", "Teknologi & SaaS", "Lainnya",
];

// The sections every playbook has, in this order.
export const PLAYBOOK_SECTIONS = [
  "Who comes, and what they came to do",
  "What decides it",
  "The pages",
  "The first screen",
  "The main action",
  "Searches",
  "Rules of the trade",
  "Photographs",
  "Where the concept comes from",
  "Clichés of this trade",
  "As a template",
];

export function parsePlaybook(text, file = "playbook") {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!m) throw new StudioError(`${file}: no front matter`);
  return { ...YAML.parse(m[1]), body: m[2] };
}

let cache;
export function loadPlaybooks() {
  if (cache) return cache;
  cache = new Map();
  if (!existsSync(PLAYBOOK_DIR)) return cache;
  for (const f of readdirSync(PLAYBOOK_DIR).filter((x) => x.endsWith(".md") && x !== "README.md")) {
    const p = parsePlaybook(readFileSync(join(PLAYBOOK_DIR, f), "utf8"), f);
    cache.set(f.replace(/\.md$/, ""), { ...p, file: `skills/playbooks/${f}` });
  }
  return cache;
}

/** Problems with a `playbook` value: a known key, or "none" when no playbook fits. */
export function playbookProblems(rel, key) {
  if (key === "none") return [];
  const all = loadPlaybooks();
  if (!all.has(key)) return [`${rel}: playbook "${key}" does not exist. Choose one of ${[...all.keys()].join(", ")}, or "none" when no playbook fits (node tools/studio.mjs playbooks)`];
  return [];
}

/** The country this deployment's marketplace serves: where a template's buyers are, unless the concept says otherwise. */
export function platformMarket() {
  return loadConfig().platform.market ?? "ID";
}

/**
 * Whether a playbook applies to a business in `country` whose site is written in `language`.
 * A playbook's rules, searches and channels belong to the country it was written for, so a
 * business elsewhere gets none. The rules follow the business, not the site's language: a villa
 * in Bali with an English site is still bound by Indonesian law, but its searches are not in Indonesian.
 */
export function playbookFit(rel, key, { country, language } = {}) {
  const problems = [];
  const warnings = [];
  const pb = loadPlaybooks().get(key);
  if (!pb || !country) return { problems, warnings };
  if (pb.country !== country) {
    problems.push(`${rel}: playbook "${key}" is written for businesses in ${pb.country}; its rules, searches and channels are that country's, and this business is in ${country}. Set the playbook to "none", ask the user what the trade's rules are there, and record the answers as facts (skills/playbooks/README.md, "Where they apply")`);
  } else if (language && pb.language && language.toLowerCase().split(/[-_]/)[0] !== pb.language) {
    warnings.push(`${rel}: the site is in "${language}" and the ${key} playbook was written for "${pb.language}" visitors. Its rules still apply (the business is in ${country}); write the searches and the copy in the visitors' language, not the playbook's examples translated`);
  }
  return { problems, warnings };
}
