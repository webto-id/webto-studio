# Stage: preflight

Find out what this machine and this token can do before promising anything.

## Do

1. `node tools/studio.mjs preflight <project>` writes `reports/preflight.json`.
2. Read the report, not only the summary:
   - `can`: which platform tools the token reaches. No `writeSites` means no
     site can be created; no `writeTemplates` means no template draft; no
     `publishSites` means the user presses Publish themselves; no
     `manageListings` means the seller creates the listing in the dashboard.
   - `limits`: the account's room. Check that one more site (or template)
     fits, and note the page and section limits for the plan stage.
   - `browser.available`: without it, every visual check is reported as not done.
3. If the pipeline needs something the token cannot do, tell the user now,
   say which permission to add, and stop until they have a new token.
4. For `landing-3d`, also note which optional helpers you have in this
   session (a Blender connection, `gltf-transform` through `npx`). Missing
   helpers narrow the recipe choice; they do not block the pipeline.

## Done

`reports/preflight.json` has `ok: true`, and the user knows about every limit
or missing permission that will shape the work.

```bash
node tools/studio.mjs checkpoint <project> preflight
```
