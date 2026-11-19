# Stage: draft

Create the site on the platform as a draft. It is not public yet.

## Read first

- `skills/core/webto-website/references/mcp.md`: the tools, the dry-run
  report, and how images are uploaded.
- `skills/meta/checkpoint-protocol.md`

## Do

1. **Upload the client's images** if the bundle has any `asset:` files:
   `begin_asset_upload`, then send the files the way the core skill
   describes. Never put file contents in a tool call.
2. **Dry run**: `create_site` without `confirm`, with the manifest, the
   variants and the chosen subdomain. Read the whole report: `manifestErrors`,
   each variant's `lint`, `warnings`, `licenses`. Fix in the bundle, run
   `studio check` again, and dry-run again until `ok: true`.
3. **The gate.** Tell the user, in their language: the site will be created
   as a draft under their account, with this many pages, at this address once
   published, and repeat every warning the dry run gave. Ask. Wait.
4. **Confirm**: the same call with `confirm: true`.
5. **Save the lock.** Write the returned `lock` to `site/webto.lock.json`
   exactly as returned. Keep the returned `previewUrl` and `previewPages` for
   the next stage; they last twelve hours.

## If this stage is being redone

The draft already exists. Do not call `create_site` again: that would make a
second site and use another slot. Follow "Workflow: changing an existing
site" in the core skill: `export_site_bundle` first, then `update_site` with
`baseRevision` from the lock, dry run, gate, confirm, save the new lock.

## Done

```bash
node tools/studio.mjs checkpoint <project> draft --approved "<what the user said>"
```
