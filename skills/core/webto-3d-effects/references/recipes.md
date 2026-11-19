# 3D effect recipes

Four recipes, each checked on a live webto site. All four are ordinary WVF variants: every rule of the variant skill (`wvf.md`, `webgl.md`) applies, and each must pass `variant-check --strict`.

| Recipe | The owner needs | The page does | Libraries | Example |
|---|---|---|---|---|
| 3D model turn | a `.glb` model of the product, plus a poster photo | three.js draws the model; the scroll turns it and the pointer tilts it | `gsap scroll-trigger three` | `examples/hero-model-glb.*` |
| Scroll-scrubbed video | an MP4 of the product turning (a Blender turntable, a phone on a turntable) | GSAP ScrollTrigger moves `video.currentTime` with the scroll: the product turns as the visitor scrolls, and back | `gsap scroll-trigger` | `examples/hero-scroll-video.*` |
| Depth parallax | one photo or render, optionally its depth map | an OGL shader shifts each pixel by its depth with the pointer and a slow drift | `ogl` | `examples/hero-depth-parallax.*` |
| Jar label turn | a photo of the jar or bottle **without** its label (transparent background) and the flat label artwork | an OGL shader wraps the flat label around the jar and turns it with the scroll; GSAP leans the jar | `gsap scroll-trigger ogl` | `examples/hero-jar-label.*` |

## Rules for all four

- **Init guard first.** Put `if (root.dataset.wvInit) return; root.dataset.wvInit = "1";` at the very top of the script, before any GSAP tween or ScrollTrigger: a re-run must not create a second set.
- **Degrade to an ordinary hero.** The owner fills the section later and will often lack the special asset, or switches to your variant from another hero whose photo sits in `imageUrl`. Read the photo from `images[0]`, falling back to `imageUrl`; without a video show that photo, without a depth map assume a centred subject, without a label show the jar alone. A variant that shows nothing without its special asset is broken (an owner's first test of these recipes showed exactly that).
- **The editor and reduced motion run no WebGL (OGL or three), and GSAP only in its end state.** What shows there is the plain markup: the model's poster photo, the video's poster, the photo, the jar with its flat label laid over the front. Make that state look finished. Thumbnails do draw the canvas (the capture waits for it).
- **Document every asset in the field's doc comment**, in words an owner understands ("[1] the label as printed: the full flat strip that wraps around the jar"). The editor shows these as the field's help.
- **Do not name a callback parameter `self`** (`onUpdate: (self) => …`, as in GSAP's own docs): `self` is a window alias and fails `script-forbidden`. Call it `st`.
- **With GSAP and OGL in one script**, OGL's `vec.set(x, y)` reads as a GSAP tween and fails `gsap-vars`: assign the components instead (`webgl.md`).
- Test on a phone before you promise it, iPhone above all.

**Ship the asset with the variant (marketplace).** A variant sold on the marketplace can carry its own `.glb` and `.mp4`, like a photo: put the file next to `variant.json` (or in `assets/`), and in `sample.json` write `"modelUrl": "asset:jar.glb"` / `"videoUrl": "asset:turn.mp4"` (the filename exactly, case included). The upload stores it once on the platform, so the marketplace preview, the thumbnail and every buyer's copy show the seller's own model or video until the buyer uploads theirs. Limits: `.glb` ≤ 10 MB, `.mp4` ≤ 15 MB, ≤ 30 MB of both per bundle, 20 files in all; the upload checks the bytes (glTF 2.0 binary, MP4). In a template bundle, `variant-check site <folder>` (≥ 0.1.64) checks the files and every `asset:` reference. Without an `asset:` the preview falls back to the poster, or to the platform's test jar `/samples/models/jar.glb` that the example uses. Only ship a model or video you own or may sell.

## 3D model turn (three.js + .glb)

The platform hosts three.js and hands it to a script that declares `data-uses="three"` as the callback's `THREE` (`null` in the editor, for reduced motion, without WebGL and past the page's 4 WebGL canvases: `if (!THREE) return;` is required, lint `three-no-fallback`). What `THREE` holds, and what it does not:

- three's core classes (`WebGLRenderer`, `Scene`, cameras, lights, materials, `Box3`, `Vector3`, `PMREMGenerator`, …) plus `THREE.RoomEnvironment` (a neutral studio for `scene.environment`) and `THREE.loadModel(el)`.
- **No loader of any kind** (`TextureLoader`, `FileLoader`, `GLTFLoader`, `LoadingManager`, `Cache`, audio): a variant cannot fetch a URL. The one way in for a model is `THREE.loadModel(el)`. It reads `data-model` from `el` (an element of the variant), accepts only a same-origin `.glb` under `/media/images/` (what the editor's upload returns), `/r2/` or `/samples/`, blocks every other URL the file references (external textures/buffers; embedded ones work), gives up after 20 s, and resolves to `{ scene, scenes, animations, cameras }`. Draco and meshopt compression are decoded by the platform.
- `WebGLRenderer` counts against the page's canvas budget, shared with OGL, and caps `setPixelRatio` at 1.5.
- `THREE` cannot be re-declared or reassigned, and `window.THREE` / `__wvThree` are refused (`script-forbidden`).

**Coming from a three.js tutorial or another three.js skill.** General three.js material (docs, tutorials, skills such as threejs-skills) is written for a page that owns the whole window. On webto, this section wins wherever they disagree. The usual habits and what replaces them:

| Habit | Here | Lint |
|---|---|---|
| `import * as THREE from "three"`, an import map, a CDN URL | `<script is:inline data-uses="three">`; `THREE` is the callback's parameter | `three-import` |
| `three/addons/…`: `GLTFLoader`, `DRACOLoader`, `KTX2Loader`, `RGBELoader`/`HDRLoader`, `TextureLoader` | `THREE.loadModel(el)` for the model; an `<img>` in the markup for a texture; `RoomEnvironment` for reflections | `three-unavailable` |
| `OrbitControls` and other controls | the scroll turns the model and the pointer tilts it | `three-unavailable` |
| `EffectComposer`, bloom and other passes | not available; get the look from lights, `toneMapping` and materials | `three-unavailable` |
| `WebGPURenderer`, TSL, React Three Fiber | `THREE.WebGLRenderer` only | `three-unavailable` |
| canvas on `document.body` at `window.innerWidth × innerHeight`, `resize` on `window` | the canvas goes in the section's `[data-gl]` box, sized with a `ResizeObserver` on that box | — |
| the scene just starts | `if (!THREE) return;` first, and a poster `<img>` that stays until the first frame | `three-no-fallback` |
| `renderer.setPixelRatio(window.devicePixelRatio)` at full value | fine to write; the platform caps it at 1.5 | — |

Everything else in core three.js works as documented: geometry, materials, lights, shadows, `AnimationMixer` for the animations a `.glb` carries (`gltf.animations`), raycasting with the pointer.

**The model (from Blender):** File → Export → glTF 2.0, format **glTF Binary (.glb)**, *Include → Selected Objects*, *Mesh → Apply Modifiers*, *Compression* on (Draco). Keep it under **10 MB** (the upload refuses more; 1–3 MB loads well on phones): decimate dense meshes, textures at 1024–2048 px, JPEG for colour maps. Put the object's base at the origin; the example centres and scales whatever it gets. Materials: Principled BSDF only (that is what glTF carries); metal and glass need `scene.environment` or they render black.

**A model from elsewhere** (Sketchfab, a 3D scan, a supplier's file, or one too big to upload): check it, then shrink it with [glTF Transform](https://gltf-transform.dev):

```
npx @gltf-transform/cli inspect model.glb
npx @gltf-transform/cli optimize model.glb model-web.glb --compress draco --texture-compress webp
```

- **Compression:** Draco or meshopt (both decoded by the platform). Prefer Draco: it is what Blender writes, and the same file opens back in Blender.
- **Textures: WebP, JPEG or PNG, embedded in the `.glb`.** Never KTX2 / Basis (`--texture-compress ktx2`, `KHR_texture_basisu`): the platform has no KTX2 decoder, the model fails to load and only the poster shows. A `.gltf` with separate `.bin` and image files will not load either; convert it (`npx @gltf-transform/cli copy model.gltf model.glb`).
- **Size:** ≤ 10 MB is a hard limit; aim for 1–3 MB. If `optimize` leaves it big, shrink the textures (`npx @gltf-transform/cli resize model-web.glb model-small.glb --width 1024 --height 1024`) or decimate the mesh in Blender.
- Only use a model the owner may publish (their own, or a licence that allows commercial use; credit the author where the licence asks).

**Markup:** one element carries both `data-model={modelUrl}` and `data-edit-model="modelUrl"` (the editor adds a "🧊 Model 3D" button to it, which opens the `.glb` upload); inside it the poster `<img data-edit-image="imageUrl">` (what the editor, reduced motion and slow loads show; the owner can still click it to change the photo) and an empty `<div data-gl class="absolute inset-0">` for the canvas. Size the element with an aspect ratio (`aspect-square w-full max-w-[…]`): the canvas follows it.

**Script order** (`examples/hero-model-glb.astro`, 5.9 KB):

1. The `wvInit` guard, then the GSAP tween of a plain object (`{ p: 0 }` → `{ p: 1 }`, scrubbed) that the render loop reads.
2. `if (!THREE || !stage || !host || !stage.getAttribute("data-model")) return;` — no model uploaded keeps the poster.
3. Renderer (`alpha: true, antialias: true`, `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`), `scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new THREE.RoomEnvironment(), 0.04).texture`, a soft hemisphere light and a key light.
4. `THREE.loadModel(stage).then(…)`: centre the model with `Box3`, scale it to a fixed size, add it to a pivot `Group`, append the canvas, size it with a `ResizeObserver`, start the loop. **Fade the poster only after the first frame**, and keep it on `.catch()`.
5. The loop eases `pivot.rotation` toward the scroll angle plus the pointer tilt (`+= (target - current) * 0.08`), so neither jumps.

**Lint notes:** three's vector `.set(x, y, z)` passes with GSAP declared when the receiver is a `const v = new THREE.X(…)` or its `.position/.rotation/.scale/.quaternion/.up`, or when every argument is a plain number expression; anything else that looks like a GSAP `.set()` is still checked. `scene.background = new THREE.Color(…)` passes on a `const scene = new THREE.Scene()` (any other `.background` assignment is a URL channel and refused). `getBoundingClientRect().top/.left` hit the `.top` ban — use `.y` and `.x`.

**Measured** (staging, desktop Chrome): three.js 222 KB over the wire (gzip), loaded only on pages with such a section and after the poster is up; the Draco decoder (≈ 100 KB) only for a Draco model; a 10 KB test jar drew within a second of load. Cloudflare's thumbnail browser draws the model too.

## Scroll-scrubbed video

- **The MP4 must have every frame as a keyframe.** A normal export (from Blender, a phone or an editor) has one keyframe every few seconds; every scroll step then decodes up to a few hundred frames and the video stutters badly. Measured on a 1080p50 file with a keyframe every 3 s: median seek 155 ms; the same video re-encoded: 5 ms. Tell the owner to re-encode, or do it for them:

  ```
  ffmpeg -i input.mp4 -vf "scale=1280:-2,fps=30" -c:v libx264 -preset slow -crf 26 \
    -g 1 -keyint_min 1 -pix_fmt yuv420p -an -movflags +faststart output.mp4
  ```

  1280 px at 30 fps is enough for a full-screen scrub and usually comes out smaller than the original; 3–8 seconds is plenty.
- From Blender: animate the product (or the camera) one full turn, render to an image sequence or MP4, then run the command above. Keep the background the colour of the section so the edges disappear.
- Markup: `<video data-scrub muted playsinline preload="auto" poster={photo} src={v.src}>` from `video(videoUrl)` (`wvf.md` §5), inside a `sticky top-0 h-screen` box in a section 2–3 screens tall (`h-[250vh]`). Only when there is a video; otherwise a normal-height section with the photo.
- Script: one `ScrollTrigger` with `scrub: true` whose `onUpdate` computes the target time, and **one seek at a time**: set `currentTime` only when the previous seek has fired `seeked`, keeping the latest target. Piling up seeks is what makes slow phones jerk.
- iOS Safari may not load a muted video's frames until it has played once: check on a real iPhone.

## Depth parallax

- From Blender: render the colour image, then the **Mist** or **Z** pass as a grayscale image (white = near, black = far) at the same resolution and camera. Normalise it so the subject is light and the background dark.
- Markup: the colour render as the poster `<img data-gl-poster crossorigin="anonymous" data-edit-image="images.0.url">`; the depth map, only when there is one, as a second `<img data-gl-depth crossorigin="anonymous" data-edit-image="images.1.url" class="hidden">`.
- Shader: `uv + (pointer + drift) * (depth - 0.35) * 0.045`, with `object-cover` UVs. Without a depth map, a radial depth around the centre. Keep the shift small (≤ 0.05): more tears the edges. Add a slow time drift so phones, which have no pointer, still see it move.
- Without a real depth map the effect is subtle; say so to the owner instead of promising 3D.

## Jar label turn

No 3D tool needed: the jar is a photo and the label is the flat file the owner already sent to the printer.

- **Assets:** `images[0]`, the jar or bottle **without** its label, upright and straight-on, on a transparent background (PNG/WebP); `images[1]`, the label as printed, the full strip that goes all the way round (its width is the jar's circumference). Three number fields place the label on the photo, in % of the photo: `labelTop`, `labelHeight`, `labelInset` (the bare glass at each side).
- **Prepare the jar photo:** crop it so the jar is centred left-to-right (`labelInset` is one number for both sides) and touches the top and bottom of the image. Keep only the jar: no shadow, no table.
- **Measure the three numbers** on the cropped photo, in % of its height (`labelTop`, `labelHeight`) and width (`labelInset`):
  - Put the label on the **straight part of the glass** only. A label running over the shoulder or the bulge at the bottom looks wrong, because the glass sticks out past a flat strip. Find it by looking at the photo row by row (or scanning the alpha channel): the rows where the jar's width stays constant.
  - `labelInset` is the bare glass between the jar's edge and the label's edge on that straight part, usually 3–6 %.
  - The shader lowers the middle of the label by 3.5 % of its height; leave that much room above the bottom bulge.
- **Check the label artwork against the jar.** The artwork's width is the jar's circumference, so its height should be about `π × jar width ÷ artwork aspect`. When the straight part of the glass is shorter than that, the label shows squashed: tell the owner, and suggest a label printed for this jar (`artwork height ≈ π × straight-part width × (labelHeight ÷ jar width in the same units)`).
- **Only half the label faces the visitor.** A wordmark wider than about 45 % of the artwork wraps out of view at both ends at the start of the turn. The flat fallback (`object-cover`) shows more of it than the turning view does; that is expected.
- **Markup:** a box sized by the jar photo itself (the `<img>` in normal flow with a fixed height and `w-auto`, so the box takes the photo's own aspect ratio and the % coordinates match it); inside it the label `<img data-label>` laid flat over the front with an inline `style` built from the three numbers (this is what the editor and reduced motion show), and an empty `<div data-gl class="absolute inset-0">` that receives the canvas. Never fix the box's aspect ratio in CSS: any photo with another ratio is letterboxed and the label lands off the glass.
- **The headline** sits behind the jar from `sm:` up; on a phone the jar covers it, so put it above the jar there (in normal flow), as the example does.
- **Script order:** the `wvInit` guard first, then the GSAP tweens, then `if (!OGL) return;` and the renderer. After every `renderer.setSize(…)` set the canvas style back to `100%` (setSize writes pixel sizes, which go stale when the box resizes).
- **Shader** (one full-box `Triangle`): for each pixel inside the label's columns, `nx` in [-1, 1] across the label, `theta = asin(nx)` is the angle round the jar, so the label's horizontal coordinate is `u = fract(turn + theta / 2π + 0.5)` (the `+ 0.5` puts the middle of the artwork, usually the product name, in front at the start) and its vertical one runs from `labelTop` to `labelTop + labelHeight`, lowered a little in the middle (`cos(theta) * 0.035`) because the jar is seen from slightly above. Darken towards the sides (`0.45 + 0.55 * cos(theta)^0.7`), add a soft highlight band, and fade the outermost 6 % so the edge does not alias. `discard` outside the label.
- **Texture:** `new Texture(gl, { generateMipmaps: false, flipY: false })`. With OGL's default `flipY: true` the label comes out upside down.
- **Turning:** GSAP tweens a plain object (`{ a: 0 }` → `{ a: 1 }`, one full turn) with a scrubbed ScrollTrigger; the render loop copies it into the shader's uniform. A second scrubbed tween leans and lifts the jar box (`rotation`, `yPercent`): plain GSAP, so it also runs where WebGL does not.
- Hide the flat label (`visibility: hidden`) only once the canvas is drawing, so there is never a frame without a label.
