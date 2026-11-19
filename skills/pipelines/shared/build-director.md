# Stage: build

Author every section, assemble the bundle, and get it clean, on disk, before
anything is sent to the platform.

## Read first

- `skills/core/html-to-webto-variant/SKILL.md` and its `references/wvf.md`,
  `design.md`, `tailwind.md`, `schema.md`. Every `.astro` follows them.
- `skills/core/webto-website/references/site-json.md` for `site.json`.
- `skills/core/webto-website/examples/warung-senja/` as a worked example.
- `landing-3d`: `skills/core/webto-3d-effects/SKILL.md` and
  `references/recipes.md` for the 3D section.

## Do

The bundle lives in `projects/<project>/site/`:

```
site/site.json
site/sections/<key>.astro
site/assets/<file>
```

1. **Theme first.** Turn `design_direction.json` into `site.json`'s `theme`:
   colours with real contrast, dark colours, fonts from the platform list,
   radius, spacing.
2. **One file per key** in `site_plan.json`'s `variants`. Author them in the
   order a visitor meets them, chrome included. Every section uses the theme
   tokens and follows the `moves`.
3. **Real content only.** Each section's `content` comes from `brief.json`
   (or the content inventory). Where the brief has nothing, the field or the
   section is left out. Copy you write (headlines, descriptions) says only
   what the brief supports.
4. **Images.** Follow `skills/meta/images.md`. The client's own files as
   `asset:<file>`; where they have none, `__IMG__:<english query>` or
   `__ILLU__:<query>`, or a photo you choose with `studio stock` when the
   picture matters; a generated image only where the design needs a
   picture neither can give, and never in place of the business's real
   people, place, product or work. Note which sections use stand-ins or
   generated images: the handoff tells the client.
5. **Preview each section as you finish it**, with its real content, as the
   core skill describes (`npx @webto-id/variant-check sections/<key>.astro
   --type <type> --content <file> --out preview-<key>.html`, run from the
   `site/` folder). Fix each one before starting the next.
6. **Check the whole bundle:**

   ```bash
   node tools/studio.mjs check <project>
   ```

   Fix every error. Read every warning; on a client's site treat
   `text-not-editable` as an error.
7. **Look at the previews** at 390, 768 and 1280 px, light and dark. With a
   browser: `node tools/studio.mjs shoot <project> --page <key>=file:///<absolute path to preview-<key>.html> --tag local`.
   A local preview has its palette baked in, so the dark one is a second
   file: build it with `--theme dark --out preview-<key>-dark.html` and
   capture that with `--tag local-dark`. Skip dark only when the site has no
   dark palette, and say so in the review.
8. **Review** following `skills/meta/reviewer.md`; write `review/build.json`.

Any edit after step 6 means running `check` again: the checkpoint compares
the report with the files on disk.

## Done

```bash
node tools/studio.mjs checkpoint <project> build
```
