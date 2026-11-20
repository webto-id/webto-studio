---
listing_category: Kuliner
covers: [warung, rumah makan, restoran, kafe, kedai kopi, katering, nasi box, kue dan bakery, frozen food, angkringan]
interview: Kuliner (warung, kafe, resto, katering, kue)
business_types: [Restaurant, FoodEstablishment]
country: ID
language: id
---

# Kuliner

## Who comes, and what they came to do

- Someone hungry nearby, on a phone, deciding in under a minute: is it open
  now, what is there, how much, how do I get it.
- Someone planning: an office lunch, a family event, a hundred nasi box for
  Saturday. They need the minimum order, how far ahead to order, the price
  per portion, and whether delivery reaches them.
- Someone who already knows the place and wants the WhatsApp number or the
  GoFood link.

A walk-in place is mostly the first; a katering is mostly the second. Ask
which one pays the bills, and order the site by it.

## What decides it

- The menu with prices. A menu without prices reads as expensive or as hiding
  something.
- Open now: the hours, near the top, including the day it closes.
- Where: the address in words people use ("depan pasar Kranggan"), a map, and
  parking if it matters.
- Real food photographs. One honest photo of the actual dish beats five
  styled stock plates.
- For katering: minimum order, order lead time, delivery area and cost, and
  what a package contains.

## The pages

- Small place: one page is enough. Hero, menu, hours and place, order.
- With a long menu: Beranda and Menu.
- Katering: Beranda, Paket (packages with per-portion prices), Cara pesan,
  and Kontak; a gallery of past events only with the owner's own photos.
- A blog only when the owner will write; never for show.

## The first screen

At 390 px, before scrolling: what kind of food, where, open or the hours,
and the order button. For katering: what they cater (nasi box, tumpeng,
prasmanan), the city, and "Pesan via WhatsApp".

## The main action

WhatsApp order, with a prefilled message that names the place
(`https://wa.me/62…?text=Halo%20Warung%20Senja%2C%20saya%20mau%20pesan`), or the
delivery app link if most orders go there. On a phone the button stays in
reach; the platform's WhatsApp bubble follows `businessProfile.phone`. Menu
items as products with `orderVia: "whatsapp"` when the owner takes orders by
chat; checkout only when they want to be paid on the site and ship or deliver.

## Searches

- kind + place: `warung makan jalan kaliurang`, `kafe tenang buat kerja di
  dago`, `bakso enak dekat ugm` (use the landmark people name);
- what + place: `nasi box semarang`, `tumpeng ulang tahun bekasi`,
  `katering harian kantor jakarta selatan`;
- price: `harga nasi box 25 ribu semarang`;
- the name, often with "menu" or "jam buka".

"Terdekat" comes from the map listing. The Google Business Profile matters
more here than in any other trade; the handoff says so first.

## Rules of the trade

- **Halal.** The halal label, and "halal" as a claim in words, only when the
  business holds a halal certificate from BPJPH and the user gave you its
  number or a photo of it (UU 33/2014 Pasal 25 and 38; PP 42/2024 as amended
  by PP 40/2026). A place that serves no pork is not thereby certified, and
  BPJPH warns that informal claims like "tanpa babi" mislead; ask for the
  certificate instead of writing one.
- **Packaged food** sold beyond the counter (frozen food, sambal in jars, kue
  kering) shows its SPP-IRT (P-IRT) number exactly as issued (Peraturan BPOM
  4/2024), or its BPOM MD or ML number. Food that keeps under seven days and
  ready-to-eat food are exempt from SPP-IRT. Never invent or imply a number.
- Prices exactly as given, with what they include (nasi, minuman, ongkir).

Checked November 2026 against the sources named; this is not legal advice.

## Photographs

Ask for: the three dishes people order most, the place from outside (so
they recognise it), the inside if people sit there, and for katering a real
set-up from a past event. Stock may stand in for mood (a market, steam, a
table), never for the dishes on the menu: a visitor orders what they see.

## Where the concept comes from

- The handwritten price board, the menu chalkboard, the receipt, the
  banner (spanduk) out front.
- The hour: a breakfast stall at six, an angkringan after nine, a kafe in
  the afternoon light.
- The way it is served: daun pisang, besek, rantang, the nasi box itself.
- The street and the landmark: the market, the campus, the station.
- The cooking: the wajan, the arang, the long simmer of a rendang.
- The owner's family story, only when the brief has it.

## Clichés of this trade

- Red and yellow as "food" colours; a chili icon; a chef's hat.
- A full-bleed dark photo of a dish with "Rasakan kelezatan..." over it.
- "Cita rasa autentik", "bahan berkualitas", "harga terjangkau".
- A batik or wayang border to mean "Indonesian food".

## As a template

The fictional business has a name, a street and a short menu with prices
that add up (a nasi box at Rp25.000 with what it contains). Use
`sampleProducts` for the menu with `orderVia: "whatsapp"` so the preview
looks like a place that takes orders. The buyer replaces: the photos of the
dishes, the menu and prices, the hours, the address. Design for a menu of
5 items and of 40, and for a buyer with no photos of the inside.
