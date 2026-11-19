# Verify add-on: parity with the old site (site-migration)

Read this together with `skills/pipelines/shared/verify-director.md`. A
migration is verified twice: once as a site, once against what it replaces.
The goal is the same content in a better design, so compare content, not
pixels.

## Do

1. **Page by page.** For each entry in `site_plan.json`'s `redirects` with a
   new path, put the old page from `content_inventory.json` next to the new
   page and check:
   - every heading's subject is still present, or its removal was approved;
   - every fact (price, address, phone, hours, name, licence number) is the
     same, character for character, unless the user corrected it;
   - every `own` image that mattered is present;
   - every contact method the old site offered still works.
2. **Dropped pages.** Each `to: null` entry has a reason the user approved at
   the plan gate. If you find one they did not see, ask now.
3. **Navigation.** Everything a visitor could reach from the old menu is
   reachable from the new one, under the same or a clearer name.
4. **Search and links.** List the old addresses that will stop resolving.
   The platform does not create redirects from an old site's addresses for
   you; say so in the review and carry the list into the handoff.
5. **Record it.** Add a finding for each gap. A changed or missing fact is a
   blocker. Add one line to `looked_at` per old page compared.

## Do not

- Carry over the old site's faults for the sake of parity: broken links,
  outdated notices and duplicate pages are fixed, and noted.
- Rewrite a fact to make it read better.
