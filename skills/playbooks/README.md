# Category playbooks

A playbook is what someone who has built many sites for one trade knows
before the first question: who visits, what they came to do, what decides it
for them, what the trade may not claim, which searches find it, and where its
ideas hide. It does not say how the site looks. Two clinics built from the
same playbook should look nothing alike; the concept (`skills/meta/concept.md`)
decides the look, and the playbook only makes sure the concept serves the
visitor.

## Where they apply

Every playbook here is written for businesses in Indonesia (`country: ID`
in its front matter) and for Indonesian visitors (`language: id`). Its
rules are Indonesian law and Indonesian professional codes; its searches,
channels (WhatsApp, GoFood, Tokopedia, SatuHaji) and clichés are Indonesian
too.

The rules follow where the business operates, not the language of the site.
`brief.json` records both: `business.country` and `language`.

| Business | Site language | Playbook |
|---|---|---|
| In Indonesia | Indonesian | Use it all |
| In Indonesia | English or another language (a Bali villa for foreign guests, an exporter) | Use it. The rules still apply. Write the searches and the copy in the visitors' language: what they type, not the playbook's examples translated |
| Outside Indonesia | Any | `"none"`. Nothing in it applies, the rules least of all |

For a business outside Indonesia, ask the user what the trade's rules are
there: licences it must show, claims that need proof, words regulators
restrict, codes its profession follows. Record the answers as facts with
`source: "user"`. Do not write another country's rules from memory, and do
not carry an Indonesian rule across as if it held there. The rest of the
studio (concept, SEO, critic, review) works the same for any country.

A template's concept records `market`, the country of the businesses that
will buy it; it defaults to the platform's market (`platform.config.json`).
The checkpoint refuses a playbook written for another country, in a brief or
in a concept.

## Choosing one

`node tools/studio.mjs playbooks` lists them with the businesses each covers.
Record the choice in `brief.json` as `business.playbook` (in `concept.json`
as `playbook` for a template), or `"none"` when nothing fits or the
business is outside the playbooks' country. A hybrid (a
bakery that also teaches classes) takes the playbook of what most visitors
come for, and borrows the other's pages where they apply.

## Reading one

| Section | Used at |
|---|---|
| Who comes, and what they came to do | brief: what to ask beyond the interview table; plan: page order |
| What decides it | plan: which facts go on the first screen and near the action |
| The pages | plan: the page set; fewer when the brief is thin |
| The first screen | concept: `first_screen` must contain these |
| The main action | plan and build: the one action, and where it sits on a phone |
| Searches | `seo_plan.json`: query patterns to fill with this business's words |
| Rules of the trade | build and review: what the copy may not say, whatever the owner asks |
| Photographs | brief: what to ask the owner for; build: what stock may not stand in for |
| Where the concept comes from | concept: places to look for an anchor, not finished ideas |
| Clichés of this trade | concept: added to the generic check |
| As a template | template-for-sale: the fictional business, the samples, what a buyer replaces |

The interview questions themselves are in
`skills/core/webto-website/references/interview.md`, under the heading each
playbook names in `interview`. A playbook does not repeat them.

## The rules section is not legal advice

It names the regulation or code each rule comes from, so the user can check
it. When the owner insists on a claim the section rules out, do not write it:
tell the user which rule it breaks. The site is theirs, and they can add it
in the editor themselves; the agent does not put it there.
