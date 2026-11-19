# webto-3d-effects

An AI skill (Claude Code, Cursor, and other agents that read `SKILL.md`) for 3D effects in [webto.id](https://webto.id) section variants: a real 3D model (`.glb`, e.g. from Blender) that turns as the visitor scrolls, a product that turns as the visitor scrolls, a photo with depth that follows the pointer, a jar whose printed label wraps around it and turns on scroll.

It is a companion to the [html-to-webto-variant](https://github.com/webto-id/variant-skill) skill, which defines the variant format; install both.

## Install

The repo root **is** the skill, so clone it straight into your agent's skills folder:

```bash
# Claude Code (project-level)
git clone https://github.com/webto-id/3d-effects-skill .claude/skills/webto-3d-effects

# Claude Code (global)
git clone https://github.com/webto-id/3d-effects-skill ~/.claude/skills/webto-3d-effects
```

Or download the zip from <https://docs.webto.id/downloads/webto-3d-effects.zip> and extract it to the same place.

## Use

Ask your agent, for example:

> Buat hero dengan toples selai yang labelnya berputar saat discroll. Ini foto toples tanpa label dan file labelnya.

> Ini file model 3D produk saya (.glb dari Blender), buat hero yang modelnya berputar saat discroll.

> Saya punya video produk berputar dari Blender, jadikan hero yang berputar mengikuti scroll.

Every variant the skill produces is checked with the CLI before it is handed back:

```bash
npx @webto-id/variant-check hero-jar-label.astro --type hero --strict --content hero-jar-label.sample.json
```

## What is inside

- `SKILL.md` — which recipe fits which assets, and the rules.
- `references/recipes.md` — the four recipes in detail.
- `examples/` — four complete hero variants that pass `--strict`, each with sample content and a marketplace manifest.

## License

MIT
