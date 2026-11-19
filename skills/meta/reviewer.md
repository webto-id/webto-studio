# Reviewing your own stage

A stage marked `review: true` is checkpointed only with a passing
`review/<stage>.json`. The review is where you catch what the validator cannot
see. Write it after the work, from what you actually opened.

## How to review

1. Read the stage's `success_criteria` in the pipeline manifest. They are the
   questions the review answers.
2. Open the real output: the preview files, the screenshots, the draft's
   preview links. List each one in `looked_at`. A review with nothing in
   `looked_at` is a guess.
3. For each thing that is wrong, write a finding:
   - `severity`: `blocker` (a visitor or buyer is misled, cannot read, cannot
     act, or the page breaks), `should` (clearly worse than it could be),
     `note` (a choice worth recording);
   - `where`: the page, section and width, so it can be found again;
   - `what`: what is wrong, as observed. "The price row wraps under the
     button at 390 px", never "layout issues";
   - `fix`: what you changed;
   - `fixed`: true only after you looked again and saw it fixed.
4. Fix every blocker and look again. Fix the `should` findings unless the
   reason not to is written down.
5. List in `checks_not_done` every check you could not make and why (no
   browser, no dark palette, no access). An empty list means you made them all.
6. `verdict` is `pass` only when no blocker is open.

## What to look for

**Truth**
- A fact on the page that is not in `brief.json` or the content inventory.
- Sample text left in a client's site ("Lorem", "Nama Anda", a placeholder number).
- A testimonial, statistic or logo the user did not give.

**Reading and acting**
- Text that cannot be read on its surface, in light and in dark.
- A heading that wraps into one orphaned word, or overflows its box.
- A button whose label is cut off, or a link that goes nowhere.
- A page the navigation does not reach.

**Layout, at 390, 768 and 1280 px**
- Sideways scroll. `studio shoot` measures it; a number above zero is a blocker.
- An image that failed to load, is stretched, or leaves its frame empty.
- Sections that collide, or a gap twice the size of the others.

**Design**
- A section that does not follow `design_direction.json`: another button
  shape, another heading style, a colour outside the palette.
- A section where the concept has gone missing (it often survives the hero
  and dies by the third section), or a layout that differs from the plan's.
- Anything on the `avoid` list, or a generic-model default from
  `skills/meta/concept.md`.
- A page that reads as a stack of unrelated blocks. Read
  `skills/meta/taste-direction.md` again if it does.

**The critic's reading** (verify only)
- The critic's `business_read` misses what, where or how to act that
  `brief.json` holds, or its `idea_read` is not the concept in
  `design_direction.json`. That is a `should`: the site is not saying it.

**Editing**
- Text the owner cannot change in the editor. The validator reports
  `text-not-editable`; treat a warning about it as a blocker on a client site.

## The file

```json
{
  "stage": "verify",
  "looked_at": ["shots/home-390.png", "shots/home-768.png", "shots/home-1280.png"],
  "findings": [
    {
      "severity": "blocker",
      "where": "home, menu section, 390 px",
      "what": "The price column pushes the page 14 px wider than the screen",
      "fix": "Let the item name wrap and keep the price on its own line",
      "fixed": true
    }
  ],
  "checks_not_done": ["Dark theme: the site has no dark palette"],
  "verdict": "pass"
}
```
