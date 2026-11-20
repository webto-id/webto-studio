# Taste and direction

The difference between a site a client pays for and one they shrug at is
almost never the code. It is whether the site looks like it was made for this
business. This file is how you decide a direction before writing a section.

## Concept first

Read `skills/meta/concept.md` and write the `concept` block before anything
else in `design_direction.json`. Everything below is derived from the chosen
concept's decisions: a direction that does not follow from the concept is two
designs fighting.

## Decide from the business, not from habit

Write down, in `design_direction.json`:

- **`language`**: two or three sentences a designer would recognise. Name the
  material, the type, the way photographs sit. "Warm paper, a serif set
  tight, photos tilted like snapshots on a counter" is a direction. "Modern,
  clean and professional" is not.
- **`palette`**: start from what the business already owns (a logo colour, the
  shop front, the packaging). One primary, one quiet secondary, at most one
  accent. Check the contrast of text on every surface you plan to use.
- **`color_mode`**: `light`, `dark` or `system`, with why. `light` is the
  default and is always safe. `dark` when the concept is a dark one (a bar at
  night, a cinema, a tattoo studio): the site is dark for everyone. `system`
  follows the visitor's device, so roughly half of phones at night see the
  dark palette: choose it only when you will design that palette as carefully
  as the light one, and write it in `palette.dark` (primary, background,
  foreground at least). A template always needs `palette.dark`, because its
  buyer can switch to dark whatever you choose.
- **`fonts`**: one for headings, one for body, from the platform's list in
  `skills/core/webto-website/references/site-json.md`. Pick the heading font
  for character and the body font for reading.
- **`moves`**: two to six recurring decisions that every section follows: how
  headings are set, the button shape, the image treatment, the rhythm of
  light and tinted sections, one or two motifs.
- **`avoid`**: what this site must not look like. Name the cliché of the
  category (the stock handshake for a law firm, the blue gradient for a
  clinic) and the generic-model defaults listed in `concept.md` that this
  category tempts, and stay away from them.

## Tests before you build

- Cover the logo. Would someone still guess the kind of business?
- Put this direction next to the last project's. If they could be swapped,
  it is not a direction yet.
- Read the `moves` aloud to someone building section seven. Do they know what
  to do without asking?

## Holding the direction

- Every section uses the theme tokens. A hardcoded colour is how a site
  drifts into two designs.
- Chrome is designed too: the navbar and the footer carry the same language.
- One idea, repeated, reads as a design. A new idea per section reads as a
  template catalogue.
- Motion follows the same rule: one kind of entrance, used sparingly. At most
  one WebGL or 3D section on a page.

## For a client

Show the concept in one sentence (with the two alternatives in a line each,
as `concept.md` says), then the direction in two or three sentences plus the
palette and fonts, in their language. Clients cannot judge a JSON file, but
they know at once whether "warm and hand-made" is their shop.

## For a template

The buyer is a category, so the direction must survive other people's
content: longer names, fewer photos, no logo. Choose moves that do not depend
on one perfect image.
