# Stage: plan

Decide the pages, the sections on each, the distinct designs to author, and
the one design language they share. Nothing is written to the platform here.

## Read first

- `skills/meta/concept.md`
- the playbook named in `brief.json` (`skills/playbooks/<playbook>.md`), all of it
- `skills/meta/seo.md`, sections 1 to 6
- `skills/meta/taste-direction.md`
- `skills/core/webto-website/SKILL.md`, steps 3 to 5 of "Workflow: a new site"
- `skills/core/webto-website/references/catalog.md` for section types
- `reports/preflight.json` for the account's limits

## Do

1. **Concept.** Following `skills/meta/concept.md`, write three candidates,
   choose one, and run the generic check. This is your decision; do not ask
   the user for styles or references. In `landing-3d` the concept stage
   already did this.
2. **Structure from the brief.** Map answers to pages and sections. Fewer,
   fuller pages beat many thin ones. Real children of a page become sub-pages
   (`parent`), one level deep. Every section gets a `purpose`: what it does
   for the visitor's goal, and a `layout` from the concept's composition.
   Neighbours on a page get different layouts. A section with no purpose is
   cut. Start from the playbook's "The pages" and "The first screen"; cut
   what the brief cannot fill.
3. **Search.** Following `skills/meta/seo.md`, write `seo_plan.json`: who
   searches and from where, then for every page its query, title,
   description and `<h1>`, and the `businessProfile` fields with the fact each
   comes from. A page that exists only for a search it cannot answer is cut.
   Where the concept's headline and the searcher's words pull apart, settle
   it here (section 3 of the skill), not in the build.
4. **Stay inside the limits.** Call `get_plan_limits` and compare: sites on
   the account, pages per site, sections per page, variants per site. Record
   the result in `limits`. If the plan does not fit, say so and offer a
   smaller plan; do not plan on an upgrade the user has not chosen.
5. **Count the designs.** List each distinct section design once in
   `variants` with its key and section type. Reuse a key across pages where
   the design is the same with other content. This is what you will author.
6. **Set the direction** and write `design_direction.json`, the concept block
   first, following `skills/meta/taste-direction.md`. In `landing-3d` the
   concept stage already wrote it: read it, do not replace it.
7. **Subdomain.** Ask what address the user wants, call `check_subdomain`,
   offer its suggestions if the name is taken, and record their choice.
8. **Migration only:** fill `redirects` with every old address from the
   content inventory and where it goes. A dropped page gets `to: null` and a
   reason.

## The gate

Show the user, in their language:

- the concept in one sentence and what the first screen shows, plus the
  other two candidates in one line each, so the user can pick another;
- the pages, and under each its sections in one line apiece, and the search
  it is meant to be found by, with its title;
- the direction in two or three sentences, with the palette and the fonts;
- the address;
- for a migration, the pages that are merged or dropped;
- anything from the brief that will not appear, and why.

Ask whether to build it. Wait.

## Done

```bash
node tools/studio.mjs checkpoint <project> plan --approved "<what the user said>"
```

In `landing-3d` this stage has no gate of its own: the concept gate covered it.
