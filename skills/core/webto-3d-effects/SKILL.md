---
name: webto-3d-effects
description: 3D effects for webto.id section variants — a real 3D model (.glb from Blender) that turns as the visitor scrolls (three.js), a product video scrubbed by the scroll, a photo or render with depth that follows the pointer (depth-map parallax), a jar or bottle whose printed label wraps around it and turns on scroll. Use whenever someone asks for "efek 3D", "model 3D", "file .glb / glTF", "produk berputar saat discroll", "3D product", "Blender di website webto", "toples/botol berputar", "parallax kedalaman", or wants a three.js / WebGL product effect in a webto variant. REQUIRES the html-to-webto-variant skill (the variant format and its WebGL contract); optional Blender MCP for making the assets.
---

# 3D effects for webto variants

Two ways to put 3D on a webto page. **A real model:** the platform hosts three.js (`data-uses="three"`) and loads one `.glb` per section through `THREE.loadModel(el)` — the variant never fetches anything itself. **A rendered result:** the 3D work is rendered (or photographed) and the page plays with it, with OGL or GSAP. This skill holds four recipes, each tested on a live webto site.

Read first: the **html-to-webto-variant** skill (`SKILL.md`, `references/wvf.md`, and `references/webgl.md` for the WebGL contract). Every variant here is an ordinary WVF variant and must pass `npx @webto-id/variant-check --strict` (≥ 0.1.62 for `three`, ≥ 0.1.61 otherwise; 0.1.63 names the three.js habits that do not work here).

## Pick the recipe from what the owner has

| The owner has (or can make) | Recipe | Example |
|---|---|---|
| a 3D model of the product (`.glb`, or anything Blender can open and export as `.glb`) | 3D model turn | `examples/hero-model-glb.astro` |
| a short video of the product turning, or Blender to render one | Scroll-scrubbed video | `examples/hero-scroll-video.astro` |
| a jar or bottle photo without its label, and the flat label file from the printer | Jar label turn | `examples/hero-jar-label.astro` |
| one good product photo or render (better: plus a depth map from Blender) | Depth parallax | `examples/hero-depth-parallax.astro` |

A model the visitor drags around freely (orbit controls) is not offered: the scroll and the pointer turn it instead, which also works on phones.

Each example comes with `.sample.json` (content for `--content`) and `.variant.json` (the marketplace manifest).

## References (read on demand)

- `references/recipes.md` — the four recipes in detail: assets and how to make them (Blender export settings for `.glb`, Blender passes, the ffmpeg command for an all-keyframe MP4), markup, shader, GSAP wiring, the measured numbers, and the rules every 3D variant follows.

## Non-negotiable rules

1. **Degrade to an ordinary hero.** Without the special asset (no model, no MP4, no depth map, no label) the section still shows a good photo, headline and CTA. Read the photo from `images[0]`, falling back to `imageUrl`.
2. **The editor and reduced motion run no WebGL (OGL or three), and GSAP only in its end state.** The plain markup is what shows there; make it look finished. Thumbnails do draw the WebGL canvas.
3. **A scrubbed MP4 must be all-keyframe** (`ffmpeg … -g 1`). An ordinary video stutters badly when scrolled.
4. **Never name a callback parameter `self`**; it fails `script-forbidden`.
5. **Never ship someone else's product shots or label artwork** in an example or a marketplace variant; use the owner's own files or generated ones.
6. **This skill overrides general three.js material.** Tutorials and other three.js skills assume a page that owns the window: `import` from a CDN, `GLTFLoader`, `OrbitControls`, `EffectComposer`, WebGPU. None of that works in a webto section; `references/recipes.md` ("Coming from a three.js tutorial") lists what replaces each one.

## Workflow

1. Ask what the owner has (the table above) and pick the recipe. If they have Blender (or a Blender MCP), offer to render the assets.
2. Prepare the assets: export the `.glb` (Draco, ≤ 10 MB; a model from elsewhere goes through glTF Transform, never with KTX2 textures), re-encode the MP4, export the depth pass, cut out the jar, as `references/recipes.md` says.
3. Start from the matching example; adapt layout and copy to the site's design, keeping the script's structure.
4. Run `npx @webto-id/variant-check <file>.astro --type hero --strict --content <file>.sample.json --manifest <file>.variant.json` until it is clean.
5. Upload, put it on a page, fill the assets (a model through the section's "🧊 Model 3D" button in the editor), and check it on a real phone. A marketplace variant can ship its own `.glb` / `.mp4` in the upload folder as `asset:<filename>` (`references/recipes.md`, "Ship the asset with the variant").
