# Stage: handoff

Leave the user with everything they need to give the site to their client,
or to run it themselves. Write `handoff.md` in the user's language, for a
reader who was not in this conversation.

## What goes in

1. **The site**: its name, public address, and whether it is published.
2. **What was built**: the pages, in one line each.
3. **What is a stand-in**: every section that uses a stock photo or an
   illustration in place of the client's own, so they know what to replace.
4. **What was left out, and why**: interview rows the client declined, facts
   that never arrived, pages dropped in a migration.
5. **How the client edits it**: they log in to the dashboard, open the site,
   and edit text and images in place. Name the two or three things they will
   most likely change (prices, hours, photos).
6. **What only the dashboard can do**, each with where to find it: a custom
   domain, payments and checkout, products, blog posts, analytics and pixels,
   the WhatsApp bubble, upgrading the plan.
7. **Who owns the site.** It lives in the account whose token made it. Two
   ways to work with a client:
   - the builder keeps the site in their own account and maintains it for the
     client (an agency plan exists for this; see the platform's documentation);
   - the client owns the site outright: for now that means building it with a
     token from the client's own account. Handing a finished site over to
     another account is not available yet; do not promise it.
8. **Migration**: the old-to-new address map from `site_plan.json`, and the
   order of the switch: publish, check, attach the domain in the dashboard,
   then retire the old site. Say that old addresses with no new page will
   stop working.
9. **`landing-3d`**: the files the 3D section uses, their sizes, and how to
   replace the model or footage (re-run the assets stage).
10. **Anything not verified**, copied from the reviews' `checks_not_done`.

## Do not

- Put the token, a preview link's signed query, or a password in the file.
- Describe a limit or a price from memory. Point to the dashboard instead.

## Done

```bash
node tools/studio.mjs checkpoint <project> handoff
```

Then tell the user the pipeline is complete, in three or four lines: the
address, what they should look at first, and what is waiting for them in the
dashboard.
