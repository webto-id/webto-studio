# Stage: concept (template-for-sale)

Decide who the template is for and why they would pick it over the ones that
already exist. A template with no buyer in mind sells to nobody.

## Read first

- `skills/meta/taste-direction.md`
- `skills/core/html-to-webto-template/SKILL.md`, "Quality bar" and "Hard limits"
- `skills/core/html-to-webto-template/references/manifest.md`, the listing
  categories

## Do

1. **Name one buyer.** Not "small businesses": a notary's office, a
   neighbourhood news portal, a dental clinic, a wedding organiser. If the
   user gave only a broad idea, propose two or three specific buyers and let
   them choose.
2. **Look at what exists.** Open the platform's catalog (`platform.catalogUrl`)
   for that category, and two or three good sites of that kind elsewhere.
   Record what you opened in `looked_at`. Note what the category's templates
   all do the same way; that sameness is the opening.
3. **Write the concept** (`concept.json`):
   - `for_whom`: the buyer and the moment they are in;
   - `promise`: what they get, in one sentence a buyer would repeat;
   - `differentiator`: what is different here, concretely (a layout idea, a
     content structure the category needs, a look);
   - `category`: one of the platform's categories, exactly as listed;
   - `pages`: at most eight, one of them the home page;
   - `working_name`: short, fit for a catalog card.
4. **Set the direction** (`design_direction.json`). A template is used with
   other people's content, so choose moves that survive longer names, fewer
   photos and no logo.
5. **Plan the sections** (`site_plan.json`): for each page, its sections and
   their purpose, and in `variants` each distinct design once. Reuse a design
   across pages. Keep the pages and the count of distinct designs inside the
   template limits in the core skill, and record that in `limits`. A template
   has no subdomain.
6. **Sample content.** Decide the fictional business the template will be
   shown with. It must be plainly fictional: no real company, no real person,
   no real phone number (the core skill names the placeholder to use).

## The gate

Show the user: the buyer, the promise, what sets it apart, the pages, the
look in two or three sentences, and the working name. Ask whether to build
it. Wait.

## Done

```bash
node tools/studio.mjs checkpoint <project> concept --approved "<what the user said>"
```
