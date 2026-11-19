# Stage: draft (template-for-sale)

Upload the bundle as a template draft under the seller's account. A draft is
not for sale and not visible in the catalog.

## Read first

- `skills/core/html-to-webto-template/references/mcp.md`
- `skills/core/html-to-webto-template/SKILL.md`, step 12
- `skills/meta/checkpoint-protocol.md`

## Do

1. **Upload the seller's own images** first, if any (`begin_asset_upload`).
2. **Dry run**: `create_template_draft` without `confirm`. Read the whole
   report. Fix in the bundle, `studio check`, dry-run again until `ok: true`.
3. **A taken name.** If the report says the listing name is taken, ask the
   seller: rename, or accept the suffix. Their answer, not yours.
4. **The gate.** Tell the seller: a draft will be created in their account
   with this many pages and sections, each section is then reviewed
   automatically, and a section with a script may wait for an admin. Repeat
   every warning. Ask. Wait.
5. **Confirm**, then write the returned `lock` to `template/webto.lock.json`.
   Keep the preview links for the next stage.

## If this stage is being redone

The draft exists. Use `export_template_bundle` first, then
`update_template_draft` with `baseRevision` from the lock (dry run, gate,
confirm, save the new lock). Relay the dry run's `manifestDiff` to the
seller: it lists what the upload overwrites, including edits they made in
the dashboard.

## Done

```bash
node tools/studio.mjs checkpoint <project> draft --approved "<what the seller said>"
```
