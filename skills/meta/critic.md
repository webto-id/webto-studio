# The blind critic

You cannot judge your own site honestly. You know what you meant, so you see
the intent instead of the screen. In the verify stage a fresh agent that has
never seen this project scores the real pages from the screenshots alone, and
its fix list is your work until the site reaches the bar.

## The critic mode

A critic costs tokens: in the demo runs, about a tenth of a client site and a
quarter to a third of a template. An agency can choose to pay less. The mode
comes from the project, else `STUDIO_CRITIC` in `.env`, else `full`;
`studio status` and `studio critic <project> --mode` show which one runs.

| Mode | What runs | The verify gate |
|---|---|---|
| `full` | A fresh critic per pass, up to the pipeline's `max_passes` | The latest pass meets the bar, or the user accepts it under the bar |
| `once` | One fresh critic; you make its fixes and capture again, and nobody judges them | Pass 1 met the bar, or the user accepts it under the bar after seeing the scores and what you fixed |
| `self` | You score your own screenshots once, from the same brief | As `once`, and the score is marked as not independent |
| `off` | No critic | Your own review of every screenshot and the measurements; the gate records that no critic judged the site |

The pipeline sets a floor (`quality_bar.critic_min`). `template-for-sale`
needs at least `once`: a template is sold to many buyers under the
platform's name. A `STUDIO_CRITIC` below the floor runs the floor, and the
tool says so.

Change the mode for one project only when the user asks (for example "tanpa
kritikus, hemat token"), after telling them what the cheaper mode leaves
unchecked:

```bash
node tools/studio.mjs critic <project> --mode once --approved "<what the user said>"
```

Never lower the mode yourself to get past the bar. In every mode but `full`,
report the mode with the result, and in `once` and `self` say that the fixes
after the pass were not judged.

The rest of this file is how a pass runs. In `self` mode, `studio critic`
prints the same brief addressed to you: open the screenshots before you
reread anything of yours, and follow it as written. In `off` there is no
pass: go on to the review and the checkpoint.

## When

After `studio shoot` has captured every page of the real draft, in every run
the stage asks for (light, dark when the site follows the visitor, reduced
motion for `landing-3d`), and after `studio motion` when anything on the
site moves (`skills/meta/motion.md`): the brief then gives the critic the
frames of each moving spot. The critic judges the screenshots and the motion
as they are on disk; capturing or measuring again afterwards makes its
critique stale.

## Run a pass

```bash
node tools/studio.mjs critic <project>
```

It prints a brief: the rubric, every screenshot to open, the measurements,
and the file the critic writes (`critique/pass-<n>.json`). Give the critic
that text and nothing else: not the brief, the plan, the design direction,
the code, an earlier score, or what you were going for.

- **Claude Code**: launch a subagent with the Agent tool (a general-purpose
  agent) and the brief as its whole prompt.
- **Codex, Cursor and other agents**: start a separate subagent or a
  background agent with its own context, with the brief as its whole task.
- **None of these available**: ask the user whether they want to paste the
  brief into a new chat with a fresh agent. If they do not, score it yourself:
  open the screenshots before rereading anything of yours, follow the rubric
  as written, set `"critic": "self"`, and tell the user plainly that the
  score is not independent.

Never reuse a critic for a second pass, and never show a critic an earlier
critique: it anchors on the old numbers.

## Read the result

```bash
node tools/studio.mjs critic <project> --result
```

It prints both readings, the scores, the weighted overall
(0.4 design + 0.3 usability + 0.2 distinctiveness + 0.1 content), the bar
from the pipeline (`quality_bar`), and the fixes.

1. **Compare the readings.** `business_read` against `brief.json`, and
   `idea_read` against `design_direction.json`'s concept. If the critic could
   not tell what the business is or does, that is the first fix. If it read
   another idea, or none, the concept is not on screen: fix the site, not the
   critic's reading. Record a mismatch as a `should` finding in
   `review/verify.json`.
2. **Do the fixes**, in the critic's order, through the platform as the
   verify director describes. A fix that would add a fact the brief does not
   hold is not a fix: leave it, and note why in the review.
3. **Capture again**, then run a new pass with a new critic.

Do not argue a score up. Dispute one only by pointing at a screenshot the
critic misread, and write that in the review as a `note`. A critic is never
re-run on the same screenshots: the tool refuses it, so a pass is final.

## The bar

The verify checkpoint passes when the latest pass is on the current
screenshots, cites screenshots that exist, and meets the pipeline's
`quality_bar`: the weighted overall at or above `overall`, and every
criterion at or above `min`.

If the bar is still not met after `max_passes`, stop. Show the user, in their
language: the scores, the critic's readings, and the fixes still open, with
the reason each is open (most often: the client's own photographs, or facts
the brief does not have). Ask whether to accept the site as it is or what to
change. If they accept:

```bash
node tools/studio.mjs checkpoint <project> verify --below-bar "<what the user said>"
```

If instead they ask for changes and a new judgement, open a new round of
passes with their words, then fix, capture again, and run fresh critics:

```bash
node tools/studio.mjs critic <project> --more-passes "<what the user said>"
```

When you report the finished site, give the last overall, say whether it
came from an independent critic or a self-score, and name the one or two
things that would raise it most.
