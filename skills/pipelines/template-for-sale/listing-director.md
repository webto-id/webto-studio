# Stage: listing (template-for-sale)

Prepare the marketplace listing. The price, and whether it goes on sale, are
the seller's to decide.

## Read first

- `skills/core/html-to-webto-template/references/mcp.md`, "Creating and
  editing the listing"
- `schemas/listing.schema.json`

## Do

1. **`get_listing_options`**: the categories, the price rules, and whether
   this seller can sell at a price (`canSellPaid`). A paid listing needs an
   active payment account, which is set up in the dashboard. If they have
   none, say so: the listing can be free, or wait.
2. **Ask the seller for the price.** Tell them the rules the tool returned.
   You may show what comparable templates in the catalog cost if you looked;
   do not recommend a number as if it were a fact, and do not pick one.
3. **Write the listing** from the manifest's `listing` block: name, title,
   description, category, tags. Add the "What will not be copied" list from
   the core template skill, filled in for this template.
4. **The gate.** Show the seller the exact listing: name, title, category,
   price, and whether it will be created as a draft or published. Default to
   a draft. Ask. Wait.
5. **If the token can manage listings**: `create_template_listing` dry run,
   then `confirm: true` with their approval. Publish only if they asked for
   it in so many words. Give them the catalog and live-preview links the tool
   returns.
6. **If it cannot**: tell them to create the listing in the dashboard, and
   give them the text to paste.
7. **Write `listing.json`** with what was approved and created, and in
   `left_for_dashboard` what remains: listing screenshots are added in the
   dashboard, and sections still waiting for review must be approved before
   the listing can go live.

## Done

```bash
node tools/studio.mjs checkpoint <project> listing --approved "<what the seller said>"
```

Then tell the seller, in a few lines: where the draft and the listing are,
what is waiting on review, and what they still do in the dashboard.
