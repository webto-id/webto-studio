# Search

A business site is found in three places: a search result, a map, and an AI
answer. All three read the same things: the words on the page, the title and
description, the headings, the image text, and the facts in the structured
data. Plan them with the pages, before any section is designed, because the
words a searcher types change what the hero says.

You have no keyword tool and need none. A small business is found by a short,
predictable set of searches. Work them out from the brief. Never quote search
volumes or rankings you did not measure, and never promise a position.

## What the platform already does

Every published site gets these without you: `sitemap.xml`, `robots.txt`,
`llms.txt`, a canonical link (to the custom domain once it is active), Open
Graph and Twitter tags, `<html lang>` from `language`, a 301 between the
`wpage.id` address and the custom domain, and one JSON-LD graph built from
`businessProfile` and the sections: the organisation (as `businessType`, with
address, phone, hours and `sameAs` links), the website, the page, breadcrumbs,
`FAQPage` from a `faq` section, a service list from `pricing`, products, team
members, and an `AggregateRating` from testimonials that carry a `rating`.
Drafts and template previews say `noindex`.

So a variant never writes `<script type="application/ld+json">`, a `<meta>`
tag, a canonical link or hidden text. A second block contradicts the
platform's.

What the platform cannot write is yours: the titles, the descriptions, the
`<h1>`, the headings, the alt text, the link text, the copy, and the
`businessProfile` facts.

## 1. Who searches, with what words

Write `searcher` in `seo_plan.json`: the person, in one line, and the place
they search from, exactly as the brief gives it (`"Dago, Bandung"`). A
business that sells everywhere online has `place: null`.

Then, for each page, the `query`: the words that person types to find what
this page offers, in the site's language and the customer's own words. A
local business is found by:

- what it is plus where: `klinik gigi anak dago bandung`, `notaris jakarta selatan`;
- what it does plus where: `tambal gigi bandung`, `jasa akta jual beli bekasi`;
- the price question: `harga katering nasi box semarang`;
- its own name, which the home page wins by itself if the name is in the title.

"Terdekat" and "near me" are answered by distance, from the map listing, not
by putting the word on the page. Use a term from the customer's mouth, not
the trade's: `sedot wc`, not `layanan sanitasi`. English only where the
customers search in English.

The playbook's "Searches" section gives the patterns for the trade; fill
them with this business's own words and place.

One page per search. Two pages aimed at the same words compete, and the
checkpoint refuses it. Give each its own, or merge them.

## 2. Which pages exist for search

- A service gets its own page only when it has content of its own: what it
  is, who it is for, the price or "mulai dari", how long, what to bring. Two
  or three services fit one Layanan page better than three thin pages.
- No page per city, district or keyword the business does not really serve
  from. Near-copies that swap the place name are doorway pages; search
  engines remove them. A business with two real branches can have a page
  for each, with its own address and hours.
- A page you decide against goes in `not_done` with the reason, so the user
  sees it was considered.

## 3. Title, description, `<h1>`

The platform uses the page's `seoTitle` as the `<title>` exactly; it adds
nothing. So:

- **Title** (`seoTitle`), at most 60 characters: the page's query, said as a
  person would read it, plus the name. Home: `Warung Senja: masakan rumahan di
  Jl. Kaliurang, Jogja`. Inner: `Harga tambal gigi di Dago | Klinik Senyum`.
  Every title is different. Uses at least one word of its query; the home
  title names the place.
- **Description** (`seoDescription`), 70 to 160 characters: what, where, the
  offer, how to act. Facts from the brief, not adjectives: `Buka 16.00–23.00 di
  Jl. Kaliurang km 5. Nasi, lauk rumahan dan wedang, pesan lewat WhatsApp.`
  It is the line that earns the click; a list of keywords earns nothing.
- **`<h1>`**, one per page: the hero `headline`. It says what and where in
  the concept's voice. The concept may want a line with no searcher's words
  in it ("Senja tidak pernah tutup"); then choose:
  1. a headline that carries both ("Makan malam rumahan, sampai senja habis
     di Kaliurang"), which is better; or
  2. the plain line as the `<h1>`, set small (the `badge` field rendered as
     `<h1>`: "Warung makan malam · Jl. Kaliurang, Jogja"), and the concept's
     line as display text in a `<p>`. Both stay editable fields. Never two
     `<h1>`.

Write all three in `seo_plan.json`, and the same title and description into
`site.json`. The audit compares them with the real pages.

## 4. On every page

- **Headings**: each section heading an `<h2>`, a heading inside a section an
  `<h3>`. Do not choose a level for its size; style it.
- **Text is text.** Opening hours, prices, the address and the offer are in
  HTML, not baked into an image. The same name, address and phone, written
  the same way everywhere on the site, as in `brief.json`.
- **Images**: `alt` says what this picture shows, specifically: "Ruang periksa
  dengan kursi gigi biru dan jendela ke taman", not "foto klinik" or the
  query again. `alt=""` only for decoration. Name asset files for what they
  show (`ruang-periksa.webp`, not `IMG_2041.webp`). Size every image with
  `img(url, width)` for its largest slot. The hero image is not
  `loading="lazy"`; images below the first screen are.
- **Links** say where they go: "Lihat harga tambal gigi", not "klik di sini".
  An icon-only link gets an `aria-label`. Contact and the main pages are
  reachable from the navbar or the footer on every page.
- **Enough to read**: a page that is a headline and a button gives search
  nothing. Say what the brief supports: what, for whom, where, when, how
  much, how to start.

## 5. `businessProfile`

The structured data says only what the business told you. Fill
`businessProfile` from `brief.json` and list each field in `seo_plan.json`
`profile` with the fact it came from; the checkpoint refuses a field whose
fact is not in the brief.

| The business | `businessType` |
|---|---|
| warung, restoran, kafe | `Restaurant` (`FoodEstablishment` for katering, bakery, snacks to order) |
| toko, butik, toko online with a shop | `Store` |
| klinik, dokter, dokter gigi, apotek | `MedicalBusiness` |
| salon, barbershop, spa, klinik kecantikan | `HealthAndBeautyBusiness` |
| bengkel, cuci mobil, rental mobil | `AutomotiveBusiness` |
| kontraktor, tukang, interior, sedot WC | `HomeAndConstructionBusiness` |
| notaris, konsultan, akuntan, pengacara, agensi | `ProfessionalService` |
| sekolah, kursus, bimbel, pesantren | `EducationalOrganization` |
| hotel, villa, homestay | `LodgingBusiness` |
| gym, lapangan, studio yoga | `SportsActivityLocation` |
| online only, or none of these | `Organization` (`LocalBusiness` for a place that fits no row) |

`address` and `openingHours` are what put the business on a map answer; ask
for them in the brief if they are missing. `socialLinks` tells search which
Instagram and marketplace pages are the same business. `logoUrl` is also the
picture a shared link shows: a page's own share image cannot be set from the
bundle.

A `rating` on a testimonial becomes a star rating in search. Only a rating
the customer actually gave, with their permission; never one you choose.
A `faq` section becomes a question list in search: only questions customers
really ask, answered with facts from the brief.

## 6. A migration keeps what ranked

The old site's addresses go into `redirects` (the plan stage). Keep an old
page's title and description when they were specific and the page was
found; rewrite them when they were "Home" or empty. A page dropped without a
redirect loses whatever it had earned.

## 7. Check it

- At the plan checkpoint, `seo_plan.json` is checked: every page has a
  distinct query, title and description, each title uses a word of its
  query, the home page names the place, and every profile field has a fact.
- At verify, run the audit on every page of the draft, with the
  `previewPages` links:

  ```bash
  node tools/studio.mjs audit <project> --page home=<url> --page <label>=<url> ...
  ```

  It reads the rendered pages at phone width: title, description, the
  `<h1>`s, heading order, alt on every image, oversized and lazy hero images,
  link text, links to pages that do not exist, the structured data, the
  words on the page, and the weight. Problems block the checkpoint; warnings
  are yours to judge and to mention.
- After publishing, run it again with `--published` on the public addresses:
  it also checks that no page says `noindex`, that `robots.txt` lets crawlers
  in, that the pages are in `sitemap.xml`, and that every internal link
  answers.

## 8. What only the owner can do

Put these in the handoff, in this order:

1. **Google Business Profile.** For a business with a place, the map listing
   brings more visitors than the site. Create or claim it at
   business.google.com, with the same name, address, phone and hours, and
   the site's address as the website.
2. **Google Search Console.** Add the site as a URL-prefix property, choose
   "HTML tag", and paste the tag in the dashboard (the site's Integrasi,
   Google Search Console). It works on the free `wpage.id` address. Then
   submit `/sitemap.xml`.
3. **A custom domain**, when they want one: it becomes the address search
   keeps, and the `wpage.id` address redirects to it.
