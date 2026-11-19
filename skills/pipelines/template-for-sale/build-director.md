# Stage: build (template-for-sale)

Author the template bundle. It is merchandise: every section must survive a
buyer's own content, and the marketplace compiles it strict.

## Read first

- `skills/core/html-to-webto-template/SKILL.md`, all of it, and
  `references/manifest.md`
- `skills/core/html-to-webto-variant/SKILL.md` with `references/wvf.md`,
  `design.md`, `tailwind.md`, `schema.md`
- `skills/core/html-to-webto-template/examples/demo-bundle/`

The core template skill is written for converting an existing HTML design.
Here there is no source: you design from `concept.json` and
`design_direction.json`. Its bundle format, manifest rules, chrome rules,
fidelity checklist and limits all apply unchanged; skip only the steps about
segmenting and matching a source.

## Do

The bundle lives in `projects/<project>/template/`:

```
template/template.json
template/sections/<key>.astro
template/samples/<key>.sample.json
template/assets/<file>
```

1. **Theme** from the design direction, in `template.json`.
2. **Author each section**, chrome included, one file per distinct design.
   Every piece of text is an editable field; every colour is a theme token.
3. **Write samples** with the fictional business from the concept. No fact
   about a real person or company, the placeholder phone number from the core
   skill, first names only on testimonials.
4. **Stress each section** before moving on. Preview it with one item, with
   the maximum number of items, with long names, and with optional fields
   missing. A section that only looks right with its perfect sample is not
   done.
5. **Images**: `__IMG__:<query>` stand-ins, or the seller's own files as
   `asset:<file>` when they hold the rights. Never another site's assets.
6. **Fill the manifest**: pages, `variants[]` with `name`, `description`,
   `mood` and `fits` as the core skill requires, and the `listing` block
   (name, title, description, category, tags) while the design is fresh.
7. **Check strict:**

   ```bash
   node tools/studio.mjs check <project>
   ```

   Zero errors and zero warnings. Templates are always checked strict.
8. **Look** at every section's preview at 390, 768 and 1280 px, light and
   dark (`studio shoot` with `file:///` paths and `--tag local`). A local
   preview has its palette baked in: build the dark one as a second file with
   `--theme dark` and capture it with `--tag local-dark`. A buyer may switch
   the template to dark, so both are required.
9. **Review**, following `skills/meta/reviewer.md`, and add the template
   questions: would this still work for a buyer with no photos? Do two
   sections disagree about what the primary colour means? Write
   `review/build.json`.

## Done

```bash
node tools/studio.mjs checkpoint <project> build
```
