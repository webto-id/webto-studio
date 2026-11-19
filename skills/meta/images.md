# Images

Where a site's images come from, in order of preference, and how to generate
one when nothing better exists.

## The order

1. **The client's own files.** Their premises, team, products, logo. Nothing
   else is as true or as convincing. Ask for them in the interview.
2. **Stock photographs.** Two ways:
   - a stand-in, `__IMG__:<english query>` for a photograph or
     `__ILLU__:<query>` for an illustration. The platform picks the picture
     when the bundle is uploaded and keeps its credit. Needs no key. You do
     not see the photo until the draft exists;
   - a photo you choose yourself with `studio stock`, when the picture
     matters (a hero, a page's only image) and a stock library key is set.
     See "Choosing a stock photo" below.
3. **A generated image**, when the design needs a specific picture that the
   client does not have and stock will not match: a hero in the site's own
   palette, a texture, an illustration in one consistent style, a poster for
   a 3D section.

## Choosing a stock photo

`node tools/studio.mjs preflight` shows "Stock photo search:" with the
libraries that have a key. With none, use stand-ins; the user can add a free
key to `.env` (see `.env.example`). Searching costs nothing.

```bash
node tools/studio.mjs stock <project> --query "<what the photo shows, in English>" --orientation landscape
node tools/studio.mjs stock-use <project> --pick <n> --out <name>.jpg
```

1. Search with a concrete query ("street food stall at night, steam, warm
   light"), not a concept ("delicious"). `--provider unsplash|pexels|pixabay`
   picks a library, `--count` up to 12.
2. **Open the previews** the search saved in `reports/stock/`. Choose for the
   design direction: light, colour, mood, and room for a heading. Reject
   photos with visible brands, recognisable faces as the subject, or text.
3. Take one with `stock-use`. What comes back depends on the library, and
   the difference is theirs, not a quirk of the tool:

   | Library | What you get | Credit on the site |
   |---|---|---|
   | Unsplash | An address on Unsplash to put in content as it is. Unsplash requires its photos to be shown from its own address | Required: photographer and Unsplash, linked |
   | Pexels | A file in the bundle's `assets/`, used as `asset:<name>` | Asked for where it fits |
   | Pixabay | A file in the bundle's `assets/`. Pixabay forbids linking to its addresses | Not required |

4. **Place the credit.** The tool prints the credit line and its link, and
   records them in `stock_images.json`. For a required credit, put it on the
   site: a small "Photo credits" line in the footer's content, or a caption
   under the image. For an asked-for credit, do the same unless the design
   has no place for it.

A stock photo is a mood picture. Like a generated image, it never stands in
for this business's own place, people, product or work.

## What a generated image must never be

A visitor reads a photograph on a business's site as evidence. So never
generate an image that would be taken for:

- this business's real premises, staff, customers or events;
- its actual product, dish, or finished work (a contractor's project, a
  clinic's results, a restaurant's own plate);
- a real person, a certificate, an award, a review, a logo of a client or
  partner, or any document.

Generate atmosphere, material, abstraction and illustration: ingredients on
a table, a texture of paper or stone, a stylised scene, an icon set, a soft
background. When in doubt, use a stand-in and tell the user
which photo they should supply.

In a template for sale these limits are looser, because everything in it is
sample content the buyer replaces. Real people and real brands stay out.

## Two ways to generate

**You can make images yourself.** Some agents have their own image tool. Use
it, save the file into the bundle's `assets/` folder as PNG, JPG or WebP
under 2 MB, and record it as in "Record it" below.

**You cannot.** Then use the user's key:

1. `node tools/studio.mjs preflight` shows "Image generation:" with the
   provider and model, or "not configured". If it is not configured, say so
   once: the user can add one key to `.env` (see `.env.example`), or you
   continue with stand-ins. Do not ask for the key in the chat.
2. **Ask before the first image.** It spends the user's own credit. Tell them
   the provider, the model, and how many images you plan, in one line, and
   wait for a yes. Then:

   ```bash
   node tools/studio.mjs image-budget <project> --max <n> --approved "<what they said>"
   ```

   The tool refuses to generate without a budget and stops when it is used
   up. Raising it is a new question to the user.
3. **Generate:**

   ```bash
   node tools/studio.mjs image <project> --prompt "<what the image shows>" --out <name>.jpg --aspect 16:9
   ```

   Aspects: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`. Choose the one
   nearest the frame the image fills. `--dry-run` shows what would be used
   without spending anything. The file lands in the bundle's `assets/`
   folder, already under the platform's size limit, and the tool prints the
   reference to use in content (`asset:<name>.jpg`).
4. **Open the image.** Reject and redo (inside the budget) one with garbled
   text, impossible anatomy, a wrong count of fingers or legs, a logo-like
   mark, or a style that breaks the design direction. One good image beats
   three doubtful ones: plan few.

## Writing the prompt

- Say what is in the frame, the light, the angle, and the style, in plain
  English: "Overhead view of a wooden table with small bowls of spices,
  soft morning window light, muted warm tones, shallow depth of field".
- Carry the design direction: name the palette's mood, not hex codes.
- Ask for no text in the image. Text belongs in the section, where the owner
  can edit it.
- Leave room where the section puts a heading: "empty space on the left
  third".
- Keep one style across a site. Reuse the same closing phrase for every
  prompt of the project.

## Record it

`studio image` writes `generated_images.json` in the project. For an image
you made with your own tool, add an entry there by hand (`file`, `provider`,
`model`, `prompt`). In `landing-3d`, list it in `assets_manifest.json` with
`rights: "generated"`. The handoff tells the client which images are
generated, so they can replace them with real photographs.
