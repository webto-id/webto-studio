# webto-studio

**Agentic website development system. Turn your AI coding assistant into a
full website studio.**

Open this folder in Claude Code, Cursor, Codex or another coding agent, ask
for a website, and the agent runs a production pipeline: it interviews,
designs every section, builds, checks its own work, and ships to
[webto.id](https://webto.id), where the site is hosted and the client edits
it in a visual editor.

Sections are written in an Astro subset with Tailwind. Motion and 3D use
GSAP, WebGL (OGL) and three.js, which the platform hosts, so a page can carry
a `.glb` model that turns on scroll without a build step of your own.

Bahasa Indonesia: [README.id.md](README.id.md)

> Status: v0.1, early. The pipelines and tools work; the demo gallery is not
> here yet.

## What it makes

| Pipeline | You say | You get |
|---|---|---|
| `client-site` | "Build a website for my client, a dental clinic in Bandung" | A designed site, live on its own address, that the client can edit |
| `site-migration` | "Move my client's site at example.com to a new design" | The old site's content in a new design, with a map of old addresses |
| `template-for-sale` | "Make a template for notary offices" | A template bundle uploaded as a draft, and its marketplace listing prepared |
| `landing-3d` | "A landing page where the bottle turns as you scroll" | One page built around a 3D moment, with an image behind it for everyone else |

## Quick start

You need Node 20 or newer, a coding agent, and a free
[webto.id](https://app.webto.id) account.

```bash
git clone https://github.com/webto-id/webto-studio
cd webto-studio
npm install
```

Create an access token in the dashboard (Settings, Security, Access tokens)
and set it as an environment variable. Do not paste it into the chat with
your agent.

```bash
export WEBTO_TOKEN="wbt_..."       # macOS, Linux
setx WEBTO_TOKEN "wbt_..."         # Windows, then open a new terminal
```

Open the folder in your agent and ask:

```
Build a website for my client Warung Senja, a small restaurant in Yogyakarta.
```

More requests to copy: [PROMPT_GALLERY.md](PROMPT_GALLERY.md).

For screenshots of the agent's own work (recommended):

```bash
npm run setup:browser
```

## How it works

Your agent is the orchestrator. This repository gives it a contract.

```
AGENT_GUIDE.md        the rules: one pipeline per request, gates, no invented facts
pipeline_defs/        the four pipelines: stages, artifacts, success criteria
skills/pipelines/     how to run each stage
skills/meta/          onboarding, self-review, approval gates, design direction
skills/core/          the craft: section format, site and template bundles, 3D recipes
schemas/              the shape of every artifact a stage writes
tools/                preflight, check, checkpoint, screenshots, old-site reader
projects/             your work, one folder per site (not tracked by git)
```

Three things keep the agent honest:

- **Approval gates.** The plan, the first write to your account, publishing
  and pricing each stop for your yes. The checkpoint tool refuses a gated
  stage that has no approval recorded.
- **Checks that are run, not claimed.** The bundle is compiled with the
  platform's own validator, and the result is tied to the files on disk: edit
  a file and the stage has to be checked again.
- **Looking at the result.** The agent captures the real pages at phone,
  tablet and desktop width, measures sideways scroll and failed images, and
  reviews the screenshots before it reports.

## What it does not do

- It does not invent facts about a business. Prices, addresses, hours and
  testimonials come from you, your client's documents, or their old site.
- It does not publish, set a price or delete a page without being told.
- It cannot attach a custom domain, set up payments, or edit products and
  blog posts; those are done in the dashboard, and the handoff note says where.
- Handing a finished site over to another account is not available yet. For
  now a client who must own the site creates the token themselves.

## Images (all optional)

Sites use your client's own images first. Everything below needs no key to
skip: without one, the platform picks a stock photo for every image the
client did not supply. Copy `.env.example` to `.env` to give the agent more.

**Stock photo search, free keys.** The agent searches a library, looks at
the candidates and chooses the photo, instead of taking what it is given.

| Library | Key | How the photo is used |
|---|---|---|
| Unsplash | `UNSPLASH_ACCESS_KEY` | Shown from Unsplash's address, with a credit, as Unsplash requires |
| Pexels | `PEXELS_API_KEY` | Downloaded into the site; credit where it fits |
| Pixabay | `PIXABAY_API_KEY` | Downloaded into the site, as Pixabay requires |

`STOCK_PROVIDER` chooses between them when several keys are set.

**Image generation, your own paid key.** When the design needs a picture
that neither the client nor a library can give, and your agent cannot make
images itself:

| Provider | Key | Default model |
|---|---|---|
| Google AI Studio (Gemini) | `GEMINI_API_KEY` | `gemini-3.1-flash-image` |
| OpenRouter | `OPENROUTER_API_KEY` | `google/gemini-2.5-flash-image` |
| OpenAI | `OPENAI_API_KEY` | `gpt-image-2` |
| fal.ai | `FAL_KEY` | `fal-ai/flux/schnell` |

Each has a `*_IMAGE_MODEL` variable to pick another model, and
`IMAGE_PROVIDER` chooses between them when several keys are set. The agent
tells you the provider, the model and how many images before the first one,
and stops at the number you agreed to. It does not generate pictures that
would pass for your client's real premises, staff, products or work.

## 3D assets with Blender (optional)

If your agent is connected to a Blender MCP server, the `landing-3d`
pipeline can model, import or generate the asset and export it as a `.glb`
the platform loads. There is nothing to switch on here: the agent uses
Blender when the connection exists and takes another route when it does not.

- The agent asks before it touches your open Blender, works in its own
  collection, and never saves or changes your file.
- A generated model may spend your credit with the generator, so the agent
  asks for a number of attempts first and stops there.
- A library model is used only under a licence that allows commercial use,
  and its licence and source are recorded.
- `node tools/studio.mjs glb <project> <file.glb>` reports a model's size,
  triangles and textures, and what would stop it from loading.

## Cost

The framework is free and MIT licensed. Your agent's usage is billed by
whoever provides your agent. A webto.id account can be free; its limits and
the paid plan are shown in the dashboard and read by the agent before it
plans anything.

## Supported agents

Any agent that reads a project instruction file and can connect to an MCP
server over HTTP. Pointer files are included for Claude Code (`CLAUDE.md`),
Codex and others (`AGENTS.md`), Cursor (`.cursor/rules/`), GitHub Copilot
(`.github/copilot-instructions.md`) and Windsurf (`.windsurfrules`). The MCP
server is configured in `.mcp.json`; if your agent keeps its MCP settings
elsewhere, copy the entry there.

## Development

```bash
npm test                      # the pipeline and checkpoint rules
node tools/studio.mjs help    # every command
```

`skills/core/` is copied from the platform's repository and is not edited
here. Everything that names the platform lives in `platform.config.json`.

## Licence

MIT
