# Stage: brief (client-site)

Learn the business well enough to design for it, and record where every fact
came from.

## Read first

- `skills/core/webto-website/references/interview.md`: the core questions and
  the table for each kind of business.
- `schemas/brief.schema.json`

## Do

1. **Use what the user already has.** A freelancer often arrives with a
   client brief, a brochure, a price list or chat notes. Read those first and
   ask only for what is missing. Facts from them get `source: "document"`.
2. **Interview in small groups**, three to six questions at a time. Start
   with the core group, then the table for this kind of business. Cover every
   row: a row the user declines goes into `declined`, a row you never asked is
   a gap.
3. **When the user is not the owner**, expect "I will ask my client". Put
   that in `open_questions`, keep going with the rest, and come back to it.
   The stage is not finished while `open_questions` has entries.
4. **Ask about the look** last: what the business should feel like, colours
   it already uses, a logo, photos it owns, a site the owner likes.
5. **Collect files** the user gives you into `site/assets/` and list each in
   `assets` with who holds the rights. `unknown` rights means the file is not
   used.
6. **Write `brief.json`.** `goal` is the one thing a visitor should do (order
   on WhatsApp, book a visit, ask for a quote). Each entry in `facts` is one
   field, its value, and its source. Do not smooth, round or complete a fact.

## Do not

- Fill a gap with a plausible value. No sample prices, no made-up hours.
- Record marketing claims as facts. "The best in town" is copy, and you write
  copy later.

## Done

Every interview row is answered or declined, `open_questions` is empty, and
every fact has a source.

```bash
node tools/studio.mjs checkpoint <project> brief
```
