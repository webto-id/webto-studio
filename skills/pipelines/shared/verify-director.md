# Stage: verify

Look at the real draft, on the platform, the way a visitor will see it. This
is the stage that catches what local previews cannot: the pages together,
the real navigation, the real images.

## Read first

- `skills/meta/reviewer.md`

## Do

1. **Get the links.** Use the `previewUrl` and `previewPages` the confirmed
   write returned. If they are older than twelve hours, ask for fresh ones
   (`get_preview_url`).
2. **Capture every page:**

   ```bash
   node tools/studio.mjs shoot <project> --page home=<url> --page <label>=<url> ...
   node tools/studio.mjs shoot <project> --page home=<url> ... --dark
   ```

   `--dark` asks for the page as a visitor whose device is set to dark. It
   shows the dark palette only on a site whose colour mode follows the
   visitor; on a site fixed to light or dark the two runs look the same, and
   one is enough.

   `landing-3d` also runs it with `--reduced-motion`: the page must read
   complete with only the poster showing.
3. **Read the measurements.** Sideways scroll, a failed image or a console
   error from the site's own code is a blocker. A console error from a
   third party is a note.
4. **Open the screenshots.** All of them. Follow the list in
   `skills/meta/reviewer.md`: truth, reading and acting, layout, design.
5. **Walk the site** when you have a browser tool: every navigation link,
   every button, the form if there is one (do not submit a real enquiry to a
   client's inbox without telling the user).
6. **Fix through the platform**, never by a second `create_site`: edit the
   bundle, `studio check`, then `update_site` with the lock's revision (dry
   run, then confirm; a fix the user already approved in kind needs no new
   gate, a change to content or structure does). Save the new lock and
   capture again.
7. **Write `review/verify.json`.**

In `template-for-sale` the thing on the platform is a template draft: fixes
go through `update_template_draft`, as the template draft director
describes, and the form is never submitted.

Without a browser, say so, put every visual check in `checks_not_done`, and
tell the user they must look at the preview themselves before publishing.

## Done

```bash
node tools/studio.mjs checkpoint <project> verify
```
