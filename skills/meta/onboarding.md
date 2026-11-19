# Onboarding

Read this when preflight does not pass, or when the user's first message does
not say what they want made.

## Getting the token in place

The user does this once. Walk them through it; never do it for them and never
ask them to paste the token.

1. Open the dashboard (`platform.dashboardUrl` in `platform.config.json`),
   then Settings, Security, Access tokens (AI agent), Create token.
2. Tick the permissions for the work ahead:
   - **Websites**: Read and Write to build sites. Publish only if they want
     you to take sites live; without it they press Publish themselves.
   - **Templates** and **Listings**: only for selling templates.
3. Choose how long it lasts, then copy it. It is shown once.
4. Set it as an environment variable (the name is `agent.tokenEnv`):
   - macOS and Linux: `export WEBTO_TOKEN="..."` in the shell that starts the agent
   - Windows: `setx WEBTO_TOKEN "..."`, then open a new terminal
5. Restart the agent so the MCP server connects, and run
   `node tools/studio.mjs preflight` again.

If preflight says `.mcp.json` does not match, run `npm run setup`.
If there is no browser, offer `npm run setup:browser`. Work can go on without
it, but every visual check must then be reported as not done.

## When the request is vague

Say in two or three sentences what this studio makes, then ask which they want:

- a website for a business (theirs or a client's), starting from nothing;
- an existing website moved over and redesigned;
- a template to sell on the marketplace;
- a landing page built around a 3D effect.

Then ask the one question that pipeline needs first: the business and what it
sells, the old site's address, the kind of business the template is for, or
the product the page is about. Do not start a long interview here; the
pipeline's own first stage does that.

## What to tell them about cost and time

Every section is designed and written for this site, so one site takes many
steps. Tell the user that the agent's own usage is what it costs them, and
that the platform account can be free: read the actual limits from the
preflight report rather than quoting numbers from memory.

## Starter requests the user can copy

See `PROMPT_GALLERY.md`.
