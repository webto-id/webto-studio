# Stage: concept (landing-3d)

Decide the page's one job, its one 3D moment, and where the asset for that
moment comes from. The 3D serves the page; a page built to show off an
effect converts nobody.

## Read first

- `skills/core/webto-3d-effects/SKILL.md` and `references/recipes.md`
- `skills/core/html-to-webto-variant/references/webgl.md`
- `skills/meta/taste-direction.md`
- `skills/core/webto-website/references/interview.md`, the core questions

## Do

1. **The short brief.** What is the page about (a product, a launch, a
   place), who is it for, and what should a visitor do at the end? Ask the
   core interview questions that apply and write `brief.json` with sources,
   as in any other pipeline. No invented facts here either.
2. **Choose one recipe** (`concept.json`, `three_d.recipe`):

   | Recipe | Fits | Needs |
   |---|---|---|
   | `model-glb` | A physical product seen from all sides | A `.glb` model |
   | `scroll-video` | A product or scene revealed in a move | An `.mp4` made to be scrubbed |
   | `jar-label` | Packaging with a label that wraps | A flat label image |
   | `depth-parallax` | One strong photograph | The photo and its depth map |
   | `ogl-shader` | An atmosphere, not an object | Nothing but a poster image |

   Pick the one the user's material supports. If they have a photograph and
   no model, the answer is not a model.
3. **Name the asset's source and rights** (`asset_source`, `rights`):
   supplied by the client (`own`), bought or downloaded under a licence that
   allows this use (`licensed`), or made in this session (`generated`, for
   instance modelled in Blender when a connection is available; read
   `skills/meta/blender.md` before proposing it). A model or video of unknown
   origin is not used. A generated model never stands in for the client's
   actual product.
4. **Name the fallback** (`fallback`): the poster image shown in the editor,
   in thumbnails, to visitors who ask for reduced motion, and while the
   effect loads. The page must make sense with only the poster.
5. **Set the direction** (`design_direction.json`). The rest of the page is
   quiet so the one moment lands: restrained palette, generous space, type
   that does not compete.
6. **One 3D section per page.** Everything else is ordinary sections.

## The gate

Show the user: the page's job, the recipe in plain words ("the bottle turns
as you scroll"), where the model or footage comes from, what visitors
without the effect see, and the look. Ask whether to go on. Wait.

## Done

```bash
node tools/studio.mjs checkpoint <project> concept --approved "<what the user said>"
```
