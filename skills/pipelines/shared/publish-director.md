# Stage: publish

Take the site live, when the user says so.

## Do

1. **Give the user the preview link** and ask them to open it on their phone
   as well as their computer. If a client decides, tell the user the link
   lasts twelve hours and can be sent on.
2. **The gate.** Say the address the site will be public at, and that it can
   be taken offline again. Ask whether to publish. Wait. A user who wants to
   show the client first is saying "not yet": stop here, and pick the stage
   up when they come back.
3. **If the token can publish**: `publish_site` dry run, then `confirm: true`.
   Give the user the public address it returns, and open it once yourself to
   see that it loads.
4. **If the token cannot publish**: tell the user to press Publish in the
   dashboard, wait for them to say it is done, then open the public address.
5. **Audit the public site**, every page, on its public address:
   `node tools/studio.mjs audit <project> --page home=<address> ... --published`.
   It checks what only a live site shows: no `noindex`, `robots.txt` open,
   the pages in `sitemap.xml`, every internal link answering. A problem here
   is reported to the user at once; a page missing from a sitemap minutes
   after publishing is normal and goes in the handoff as a thing to check.
6. Log it: `node tools/studio.mjs log <project> "Published at <address>"`.

Publishing a change to a site that is already live follows the same gate.

## Done

```bash
node tools/studio.mjs checkpoint <project> publish --approved "<what the user said>"
```
