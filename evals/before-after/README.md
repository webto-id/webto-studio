# Before/after eval

Did the design-quality work (a concept before layout, the blind critic, the
search plan, the trade playbooks) make better sites, or only longer
instructions? And where should the critic's bar (`quality_bar`) sit?

Five short requests (`cases.json`), each with the answers a client gives
when asked. Two versions of the studio build each one:

| Version | Commit | What it has |
|---|---|---|
| before | `35564dc` | v0.1 with images and handoff; no concept, critic, search plan or playbooks |
| after | current `main` | all of it |

One critic from the current version then scores all ten sites from fresh
screenshots, under codes that do not say which version built them.

## Rules for a fair run

- Same model and the same agent (Claude Code) for every build.
- Same answers: the builder takes them from its brief, never from a person.
  Gates are recorded in `eval-gates.md` and passed as "ya, lanjut".
- No image keys, no generation. Stock photos only if both worktrees have the
  same stock keys.
- Staging only, drafts only: nothing is published.
- One fresh critic per site, one pass, no fixes after scoring.

## Run it

1. Two worktrees, each with the same `.env` (`WEBTO_TOKEN` for a staging
   account, `WEBTO_MCP_URL=https://<staging api>/mcp`), then `npm install`
   and `npm run setup` in each:

   ```bash
   git worktree add ../webto-studio-before 35564dc
   git worktree add ../webto-studio-after main
   ```

2. For each case and each worktree, start a fresh agent session in that
   worktree with the brief as its whole first message:

   ```bash
   node evals/before-after/run.mjs brief klinik-gigi
   ```

3. Collect what each version built (from this checkout):

   ```bash
   node evals/before-after/run.mjs collect before ../webto-studio-before
   node evals/before-after/run.mjs collect after ../webto-studio-after
   ```

4. Capture every site under a blind code (needs the token here too):

   ```bash
   node evals/before-after/run.mjs shoot
   ```

5. For each code, `node tools/studio.mjs critic eval-<code>` prints the
   critic's brief; give it to a fresh agent, as `skills/meta/critic.md` says.

6. Read the result:

   ```bash
   node evals/before-after/run.mjs report
   ```

   It prints each site's scores, the mean per version, the per-case
   difference, and how many sites of each version pass each candidate bar.

## Choosing the bar

The bar should be one that the "after" sites reach within the critic's
passes and that most "before" sites do not. If the "after" sites cannot
reach it, the bar is set above what the studio can do and every project
will end with the user asked to accept a site below it. If the "before"
sites pass it too, it does not measure the work. Set the result in each
`pipeline_defs/*.yaml` `quality_bar`, and write the numbers here.

## Results

Run on 20 November 2026: Claude Code, Opus 5.5, the platform's staging,
five cases, one fresh critic per site. Scores below are round 2, from
screenshots taken after `shoot` was fixed to walk the page at a reader's
pace (round 1 photographed some entrance effects before they ran, which hid
whole sections and hit the old studio's sites hardest; `runs/round-1-report.txt`).

| Case | Before | After | Difference |
|---|---|---|---|
| klinik-gigi | 6.75 | 7.30 | +0.55 |
| katering | 6.55 | 7.25 | +0.70 |
| kontraktor | 6.95 | 7.15 | +0.20 |
| kursus | 6.20 | 6.95 | +0.75 |
| laundry | 6.80 | 7.30 | +0.50 |
| **Mean** | **6.65** | **7.19** | **+0.54** |

The new studio was better in all five cases, most in distinctiveness (6.9 to
7.6), design (6.7 to 7.2) and usability (6.3 to 6.9); content barely moved
(7.0 to 7.2), because both versions had the same facts and no photographs.

**The bar stays at 7 overall and 6 per criterion, 3 passes.** No old site
met it; four of five new sites did, and the fifth (6.95) scored 7.3 from the
critic inside its own verify stage. Nothing met 7.5. The same site scored by
two critics differed by up to 0.35, so a bar between 7 and 7.5 would only
measure the critic's mood.

**Cost.** One build took 20 to 25 minutes and about $6 to $12 at API
prices, mostly cached input; the new studio cost about a third more (the
three concepts and two critic passes). A build cut off by a usage limit
and resumed cost about $4 more to reload its context. One critic pass is
about 120 to 160 thousand tokens.

**What pulled every site down, whichever version built it:**
- no photographs of the business (the cases had none, as most short requests do);
- the platform's floating WhatsApp button over content on phones;
- form pages: the anti-bot widget delays loading past 45 s in a headless
  browser, logs a CSP error and leaves an empty band above the submit button;
- the platform map section, styled unlike the custom sections around it, and
  empty in screenshots;
- fictional phone numbers read as placeholders (expected; they are).

Round 2 still had one capture fault: the part shots drew everything fixed
on the screen (the WhatsApp button, the platform's "Dibuat dengan webto.id"
bar) wherever the capture left it, over content it does not cover for a
visitor. Five of ten critics took points off usability for it, on old and
new sites alike, so it does not change the comparison or the bar. `shoot`
now shows fixed elements in the first-screen shots only.
