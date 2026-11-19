# Stage: inventory (site-migration)

Read the old site into a record of what it holds, then turn that record into
a brief. The old site is the source of facts here, and the user is the judge
of which facts are still true.

## Read first

- `schemas/content_inventory.schema.json`, `schemas/brief.schema.json`
- `skills/core/webto-website/references/interview.md`

## Do

1. **Ask before reading.** Is the user (or their client) the owner of this
   site, and may its text and images be reused? Only on a yes:

   ```bash
   node tools/studio.mjs crawl <project> <url> --authorized
   ```

   It reads up to 20 pages of the same host (`--max` raises it, to 60), obeys
   `robots.txt`, and writes `content_inventory.json`. If pages come back with
   no text, the site builds itself in the browser: run again with `--render`.
2. **Read the inventory yourself.** The crawler extracts; it does not
   understand. Open the old site's main pages (with a browser tool if you
   have one) and correct the record: remove cookie banners and menu noise from
   `text_blocks`, add what the crawler missed, and note what each page is for.
3. **Mark image rights.** Every image starts as `unknown`. Ask the user which
   photographs and graphics the client owns (their premises, team, products,
   logo) and mark those `own`. Stock photos, theme decorations and icons from
   the old site's template stay `unknown` and are not carried.
4. **Fill `not_carried`** with what the old site does that the new one will
   not, in plain words: a booking plugin, a members' area, a shop's order
   history, a blog's comments, embedded widgets. Check the platform's limits
   in `AGENT_GUIDE.md` ("What you cannot do").
5. **Write `brief.json`** from the inventory: facts get `source: "old_site"`.
   Then ask the user what is out of date. Old sites carry old prices, old
   hours and staff who left. A corrected fact gets `source: "user"`.
6. **Interview for the gaps.** Run the table for this kind of business in
   `interview.md` and ask only what the old site did not answer. Ask about the
   look too: keep the brand's colours and logo, or start fresh?
7. **Download the images marked `own`** into `site/assets/`, within the
   platform's limits (the core skill's "Hard limits"), and list them in the
   brief's `assets`.

## The gate

Show the user: the pages found, the facts that will be carried, what is out
of date and was corrected, what will not be carried and why, and what is
still missing. Ask whether this is the right starting point. Wait.

## Done

```bash
node tools/studio.mjs checkpoint <project> inventory --approved "<what the user said>"
```
