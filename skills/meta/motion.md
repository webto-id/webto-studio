# Motion

How a site moves, and how to check it. The mechanisms live in the core
skills and are not repeated here:

| What | Where |
|---|---|
| Entrance reveals, staggers, counters, soft parallax, no script | `skills/core/html-to-webto-variant/references/wvf.md` §5b (`data-wv-effect`) |
| GSAP timelines, ScrollTrigger, pin and scrub | `wvf.md` §4a (`data-uses="gsap scroll-trigger"`) |
| The Webflow/Framer scroll effects by name: stacking cards, text that fills on scroll, horizontal gallery, image zoom, clip reveal, sticky steps, velocity marquee, colour change, magnetic button | `skills/core/html-to-webto-variant/references/gsap-recipes.md`, tested variants in `examples/gsap/` |
| WebGL with OGL: poster, one canvas per section, at most four | `skills/core/html-to-webto-variant/references/webgl.md` |
| three.js and `.glb` models, scroll video, depth parallax | `skills/core/webto-3d-effects/references/recipes.md` |

## 1. Where motion comes from

The concept's `motion` line (`skills/meta/concept.md`) is a verb taken from
the business: a drawer that slides, a stamp that lands, paper that settles,
a line drawn once. Every moving thing on the site does that verb, or is
still. A site with three kinds of entrance has no motion idea, only effects.
"Still" is a good answer for a notary, a clinic's price list, or any page a
visitor comes to read quickly; say why in the concept.

## 2. The lightest tool that does it

1. `transition-*` for hover and focus.
2. `data-wv-effect` for things entering the screen: no script, reviewed once
   by the platform, and the platform turns it off for reduced motion, in the
   editor and in thumbnails.
3. GSAP for motion that is part of the design: one choreographed moment per
   page (a hero timeline, a pinned story, a scrubbed sequence). On every
   section it reads as noise.
4. WebGL or a 3D model for one section per page at most, always with a poster
   that carries the section alone.

Never your own `IntersectionObserver` for reveals: the platform's runtime
already does it, and two runtimes fight. GSAP plugins other than
ScrollTrigger (SplitText, Flip, Draggable) are not available; reveal text
by line with one element per line and a stagger instead.

## 3. Timing

- Things entering: 300 to 600 ms, easing out (fast start, soft landing).
  Longer reads as slow; a visitor scrolling past never sees the end.
- Stagger between siblings: 40 to 80 ms. Six items take under half a second.
- Hover and press: 120 to 200 ms.
- Nothing time-based over a second except a hero's first timeline, played
  once. Scroll-driven (scrubbed) motion follows the thumb instead of a clock.
- Animate from the visible state (`gsap.from`), so content stays readable if
  the script never runs.
- Calm trades (health, law, finance, a funeral home) move less and slower;
  playful ones (a café, a kids' class) may bounce, once.

## 4. On a phone

Most visitors arrive on a mid-range Android with a thumb, not a trackpad.

- A pinned section holds for at most three screens of scrolling. Longer
  feels like the page is stuck.
- No sideways scroll driven by vertical scroll on a phone: at 390 px turn the
  horizontal track into a stack (`ScrollTrigger.matchMedia`).
- Animate `transform` and `opacity` only. Animating `top`, `height`, `width`
  or filters on scroll is what makes a phone stutter.
- A 3D model loads well at 1 to 3 MB (10 MB is the upload's hard limit); a
  video on a phone stays under 8 MB. Both start only when their section is
  near.
- Reduced motion: the page must read complete with every effect off and only
  posters showing. The platform does this for `data-wv-effect` and GSAP
  variants; your own CSS animations need the media query.

## 5. Checking it

Screenshots are stills. In the verify stage, `studio motion` scrolls each real
page on a phone slowed four times (a mid-range Android) and on a laptop, and
keeps two frames at each moving spot (as it enters, and 0.7 s later) for the
critic. It is required when the site loads GSAP, OGL, three.js or Lenis, and
for every `landing-3d` page.

| It finds | Means | Level |
|---|---|---|
| An entrance effect that never ran, even in the middle of the screen | Its content stays invisible | Problem |
| A canvas on screen that drew nothing | The WebGL or 3D failed; the poster did not take over | Problem |
| Sideways scroll while scrolling | A pin or a moving element wider than the screen | Problem |
| A console error while scrolling | A script fails mid-way | Problem |
| Over 20% of frames slower than 50 ms on the laptop | It stutters even on good hardware | Problem |
| The same on the slowed phone | It will stutter for many visitors | Warning |
| Over 600 ms of blocked main thread while scrolling | Scroll handlers or heavy setup | Warning |
| Layout shift above 0.1 while scrolling | Something changes size as it enters | Warning |
| A pin longer than three phone screens | Feels stuck | Warning |
| Model over 3 MB or video over 8 MB on a phone | Slow to arrive | Warning |

Fix problems before the critic. For a warning, fix it or say in the review
why it stays. Run `studio motion` again after any fix that touches motion:
the critic's pass must be on the latest measurement.
