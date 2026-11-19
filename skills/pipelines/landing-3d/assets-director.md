# Stage: assets (landing-3d)

Get the model, footage or images into the shape the platform accepts, and
make the poster. Size is the constraint that decides everything here: the
page has to load on a phone.

## Read first

- `skills/core/webto-3d-effects/SKILL.md`: preparing a `.glb`, what the
  platform's 3D runtime supports, and the size limits
- `skills/core/webto-3d-effects/references/recipes.md`: what each recipe
  expects of its files

## Do

Files go in `projects/<project>/site/assets/`. Names use only letters,
digits, dots, hyphens and underscores.

1. **Collect the source** named in the concept. For a `generated` asset,
   make it now with the helper you have, and note the tool in `made_with`.
2. **Prepare it** the way the core skill describes for its kind:
   - a model: one `.glb`, compressed and with textures resized as the skill
     shows, using only the features it lists as supported;
   - a video: an `.mp4` encoded for scrubbing as the recipe specifies, with
     no audio track;
   - images: PNG, JPG or WebP, sized for the frame they fill.
3. **Check every file against the platform's limits** in the core skill
   (per file, per kind, and in total). Aim well under them: the limit is what
   uploads, not what loads fast.
4. **Make the poster**: a still of the model or the video's first frame, or
   the photograph itself. It carries the section for every visitor who does
   not get the effect, so light and frame it as a finished image. A poster
   for an `ogl-shader` section may be generated (`skills/meta/images.md`); a
   poster of a real product is a render or photograph of that product.
5. **Write `assets_manifest.json`**: every file with its kind, size in
   bytes, role, and rights; and `poster`.

## Do not

- Ship a file whose origin you cannot name.
- Reference anything by URL from another site. Every asset is uploaded with
  the bundle.

## Done

```bash
node tools/studio.mjs checkpoint <project> assets
```
