# Stage: verify

Look at the real draft, on the platform, the way a visitor will see it. This
is the stage that catches what local previews cannot: the pages together,
the real navigation, the real images.

## Read first

- `skills/meta/reviewer.md`
- `skills/meta/critic.md`
- `skills/meta/seo.md`, section 7

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
4. **The search audit**, on the same links, every page:

   ```bash
   node tools/studio.mjs audit <project> --page home=<url> --page <label>=<url> ...
   ```

   Every problem is fixed the way step 7 describes, then the audit runs
   again: the checkpoint judges the saved audit against `seo_plan.json` as it
   is then, and refuses one taken before the last `update_site`. Read the
   warnings (`skills/meta/seo.md`, section 7) and fix those that apply. In
   `template-for-sale` there is no search plan: the audit checks the
   structure a buyer's site inherits (one `<h1>`, alt, links).
5. **Open the screenshots.** All of them. Follow the list in
   `skills/meta/reviewer.md`: truth, reading and acting, layout, design.
6. **Walk the site** when you have a browser tool: every navigation link,
   every button, the form if there is one (do not submit a real enquiry to a
   client's inbox without telling the user).
7. **Fix through the platform**, never by a second `create_site`: edit the
   bundle, `studio check`, then `update_site` with the lock's revision (dry
   run, then confirm; a fix the user already approved in kind needs no new
   gate, a change to content or structure does). Save the new lock and
   capture again, and audit again.
8. **The blind critic.** Once your own findings are fixed and every run is
   captured, follow `skills/meta/critic.md`: `studio critic <project>`, a
   fresh agent with that brief only, then `studio critic <project> --result`.
   Work through its fixes the way step 7 describes, capture every run again,
   and run a new pass with a new critic, until the latest pass meets the
   pipeline's `quality_bar` or the passes run out and the user decides.
9. **Write `review/verify.json`**, including the critic's readings where
   they did not match the brief or the concept.

In `template-for-sale` the thing on the platform is a template draft: fixes
go through `update_template_draft`, as the template draft director
describes, and the form is never submitted.

Without a browser, say so, put every visual check in `checks_not_done`, and
tell the user they must look at the preview themselves before publishing.

## Done

```bash
node tools/studio.mjs checkpoint <project> verify
```

Add `--below-bar "<what the user said>"` only when the user accepted a site
under the bar. When you report, give the critic's last overall and say
whether it was independent.
