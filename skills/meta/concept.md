# Concept: the idea that cannot be moved

Most requests are one line: "a website for a dental clinic in Bandung". A
generic model turns that line into the site every clinic already has. A
concept is how you avoid that: one idea, taken from this business's own
world, that decides the layout, the type, the colour, the images and the one
moment people remember.

A concept is a rule system borrowed from a world. "Clean, modern, trustworthy"
is a style. "The site reads like the clinic's appointment card: one column,
times set large, every section a line you could fill in" is a concept: it
dictates layout (a card, rows), type (a form's labels and figures), colour
(the card stock and one ink), imagery (few, square, documentary) and the
signature (booking set as the card's last line). If you cannot derive four
decisions from the sentence, it is a style.

## You decide, the user approves

Design is your job. Do not ask the user which style they like, which colours,
or for "references". Ask only for facts (the brief). Then decide the concept
yourself and show it at the plan gate, where the user can take it, pick one of
the other two, or say what feels wrong.

## Six territories

Write three candidates, each from a different territory.

1. **`name`**: what the business's name means, sounds like, or looks like set
   in type. *Senja* is dusk; *Sumber* is a spring. Only when it is elegant;
   never a pun that needs explaining.
2. **`trade`**: the material of the trade. A notary's deeds, seals and folio
   numbers; a dentist's charts and the white of enamel; a bakery's flour,
   proofing times and oven tickets; a workshop's part numbers and torque
   specs.
3. **`place`**: the street, the city, the building. Bandung's art deco
   facades, a Yogyakarta kampung's painted gang signs, a market's hand-lettered
   price boards, the colour of a particular coast. Specific, never a flag, a
   map pin or batik as a border.
4. **`process`**: how they actually work, from first contact to result. The
   tailor's measuring card, the kitchen's order of service, the course from
   consultation to aftercare. The site performs the process.
5. **`customer`**: the visitor's moment. A parent choosing a school at
   night, a couple planning a wedding a year ahead, someone with a toothache
   on a Sunday. The site is built around what that person needs first.
6. **`system`**: one strict formal rule taken all the way. Everything set
   like a price list; one typeface at two sizes; a single column like a
   receipt; a grid of nine squares.

## Method

1. For each candidate write: one sentence a stranger understands (`idea`);
   the `anchor`, the specific fact the idea depends on, and where it comes
   from (`anchor_source`); the five `decisions` it produces (layout, type,
   colour, imagery, signature); and the `swap_test`.
2. **The swap test.** Put another business of the same kind in the sentence.
   If it still works, the idea is portable: a style. Write what happens.
3. **Score** each 1 to 5: `originality`, `fit` to this business and its
   visitors, `feasibility` within the platform (WVF sections, Tailwind, the
   hosted GSAP, Lenis, OGL and three.js), and `portability` (lower is better).
4. **Choose** the best total. A candidate with portability 4 or 5 cannot be
   chosen; the checkpoint refuses it. You may take one detail from a
   runner-up for a small place (the footer, the contact block, the 404) and
   write it in `borrowed`; never for the main structure.
5. **Kill a concept whose only expression is the hero.** It has to survive to
   the footer, the inner pages and the contact section.
6. Write the chosen one out in full: `idea`, `anchor`, `signature` (the one
   moment, and the section that carries it), `motion` (how things move here,
   as a verb: "slide like a drawer", "stamp", "settle like paper", or "still"
   with the reason), and `first_screen` (what a visitor sees before scrolling,
   at 390 and at 1280 px).

## Honest anchors

The anchor is a fact, never a story you made up so the concept works. It
comes from `brief.json` (`brief`), the old site (`inventory`), the business's
name (`name`), the place it is in (`place`, public knowledge about the city or
street), or, for a template, its buyer's category (`category`). No invented
founding year, family recipe, heritage or award. When the brief has little
that is specific, the name, the place, the trade and the customer's moment
are always there.

## Scale the theatre to the business

A clinic, a notary or a warung earns the same craft as an award site, in type,
layout, colour and image treatment, but rarely the spectacle. The signature can
be a still composition: a menu set like the shop's own price board, a hero
where the type is the image. When it moves, it moves once and with purpose:
one GSAP or ScrollTrigger moment, not an entrance on every section. At most
one WebGL or 3D section on a page, and only when the business earns it (see
`skills/core/webto-3d-effects`).

Signatures that work inside a section:

- display type used as the image, set to the concept, with one real photo;
- an index list of services, dishes or rooms whose image follows on hover
  (and opens on tap: nothing may depend on hover);
- a pinned sequence where one thing changes across three steps (the process);
- a colour or light that shifts across one section as it scrolls;
- a before and after, only with the client's own photographs;
- a timeline or route that draws itself, when the content is a real sequence.

## The generic check

Before you write `design_direction.json`, ask of each part: if a generic
model got this one-line prompt, would it land here? Fill `generic_check` for
at least `first_screen`, `palette`, `type`, `layout` and `imagery` (`copy` and
`chrome` when you checked them). Where the answer is yes, change it and write
what you changed. The checkpoint refuses a generic part with no change.

What generic models land on (avoid them unless the concept demands one, and
then do it with conviction):

- a centred headline over a dim stock photo or a gradient blob;
- "Selamat datang di ..." or "Solusi terbaik untuk ..." as the headline;
- three equal cards with an icon each; a strip of round-number statistics;
- purple-to-blue gradients; acid green on black; glass panels everywhere;
  cream and terracotta with a serif as the default "warm";
- a small label above every heading; 01, 02, 03 when nothing is a sequence;
- a carousel of three testimonial cards;
- every section fading up as it scrolls in;
- the category cliché: teal and white for a clinic, gold on black for a law
  office, red and yellow for food, a green leaf for anything natural, a batik
  border to mean "Indonesian";
- the clichés the business's playbook lists (`skills/playbooks/`).

The playbook's "Where the concept comes from" names places to look for an
anchor in that trade. They are places, not ideas: the anchor is still a fact
of this business.

## Composition

The concept decides how sections sit, so each section in `site_plan.json`
gets a `layout`: its layout family, in a few words. Two sections next to each
other on a page never share one (the navbar and footer are not counted); the
checkpoint refuses it. Families to choose from, among others: split with the
image left or right, full-bleed image with type over it, type-only statement,
index list, asymmetric grid, bento of unequal tiles, single narrow column,
staggered rows, horizontal strip, timeline, map and details, form beside
facts. A page that alternates the same two families reads as a template.

## Where the concept is a constraint

- **Migration:** the client's logo and colours often stay. Write what is kept
  in `keeps`; the concept works with it unless the user asked for a rebrand.
- **Template:** the anchor is the buyer's category (`category`). The concept
  must survive other people's content: longer names, fewer photos, no logo.
- **Landing 3D:** the 3D moment is the signature. The concept decides how
  the rest of the page frames it.

## At the gate

In the user's language and in plain words, never the JSON and never the
scores: the idea in one sentence, what the first screen shows, and the other
two candidates in one line each, so they can choose another.

## The block

```json
"concept": {
  "candidates": [
    {
      "name": "Kartu janji",
      "territory": "process",
      "idea": "The site reads like the clinic's appointment card: one column, times set large, each section a line to fill in.",
      "anchor": "Patients book by WhatsApp and get a card with the time written on it",
      "anchor_source": "brief",
      "decisions": {
        "layout": "One narrow column on a card, ruled lines between sections",
        "type": "A sturdy grotesk for labels, large tabular figures for times and prices",
        "colour": "Card white, one ink blue, a red only for the booking line",
        "imagery": "Few photos, square, documentary: the real room and staff",
        "signature": "The booking section is the card's last line, filled in as you scroll"
      },
      "swap_test": "Another clinic that books by card could use it, but the ruled card and the filled-in line come from this clinic's own habit",
      "scores": { "originality": 4, "fit": 5, "feasibility": 5, "portability": 2 }
    }
  ],
  "chosen": "Kartu janji",
  "why": "It fits how this clinic already works and stays specific down to the footer",
  "idea": "The site reads like the clinic's appointment card.",
  "anchor": "Patients book by WhatsApp and get a card with the time written on it",
  "signature": "hero-kartu: the time and the booking line set large, completed by the scroll",
  "motion": "write: lines draw left to right, once",
  "first_screen": "At 390 px the clinic's name, the next free hours and the WhatsApp button on one card; at 1280 px the card beside one photo of the room",
  "generic_check": [
    { "part": "first_screen", "generic": true, "change": "Dropped the centred headline over a stock smile for the card with real hours" },
    { "part": "palette", "generic": true, "change": "Teal and white replaced by card white, one ink and a booking red" },
    { "part": "type", "generic": false },
    { "part": "layout", "generic": false },
    { "part": "imagery", "generic": true, "change": "No stock smiles; the room and staff, or a typographic block where there is no photo" }
  ]
}
```

(The example shows one candidate; yours has three.)
