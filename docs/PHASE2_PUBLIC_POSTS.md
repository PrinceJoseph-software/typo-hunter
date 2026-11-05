# Phase 2 design: public typo posts by city

**Status:** proposal, awaiting owner approval. Nothing here is built yet.

## Goal

Let people **choose** to share a find publicly, so anyone can browse the typos spotted in their city on the front page. A post is **text only**: what it said, what they meant, the category, the city and the "Read by app" label. The photo never leaves the phone.

Decisions already made by the owner:

| Topic | Decision |
|---|---|
| Verification | Text reading happens on the phone only. Posts show **"Read by app"**, never "verified". |
| Location | **City only** by default. Frequent, trusted posters can unlock **neighbourhood**, with the safety rules below. |
| Identity | **No account.** An anonymous device key, posting limits, and a **flag** button on every post. |

## What a post looks like

> **"COFFE AND TREA"** → *Coffee and Tea*
> Menus · Lagos · 2 days ago · ✓ Read by app · [Flag]

Not shown: photo, exact location, name, device ID. Showing the poster's display name is optional per post, and the default is anonymous.

## How it fits the current app

```
Phone (existing offline app)                 Vercel (free Hobby plan)             Database (free tier)
───────────────────────────                  ───────────────────────              ────────────────────
Capture → "Share publicly?" (opt-in)  ──▶   /api/posts       (validate, limit) ──▶ posts, devices,
city picked on the phone                     /api/posts/:id/flag                     flags, cities
queued offline, sent when online             /api/feed?city=…                        (Postgres)
                                             /city/<name>  (server-rendered page for search engines)
Front page (/) ◀── recent posts + "Typos in <city>" lists
```

- The API runs on the **same domain** (`/api/*`), so the strict security policy (`connect-src 'self'`) stays as it is and no third party is contacted from the phone.
- The offline app keeps working without the server. Sharing is the only online feature, and a queued post is sent when the phone is back online.

## Location: city first, neighbourhood carefully

**City (default).** The phone works out the nearest city **on the device**, using a bundled list of world cities (GeoNames "cities with 15,000+ people", CC BY 4.0, about 26,000 cities). Only the city ID is sent. No reverse-geocoding service is used, and GPS coordinates never leave the phone. Users can also pick a city by hand instead of using GPS.

**Neighbourhood (unlock).** Precision is a grid cell of about 1 km. The poster must meet all of these:

- the device key is at least **14 days old**;
- at least **15 public posts** that weren't removed, posted on at least 5 different days;
- **no upheld flags** in the last 30 days;
- the user confirms they are **16 or older**.

Even when unlocked, a post only shows its neighbourhood if **all** of these hold:

1. **Opt-in per post.** The default stays "city".
2. **Delay.** The neighbourhood appears **24 hours** after posting, so it can't reveal where someone is right now.
3. **Crowd rule.** A neighbourhood is shown only when it already has posts from **at least 3 different devices**. Otherwise the post shows the city. This stops one person's posts mapping their daily route.
4. **Home zones.** Users can mark places (home, school, work) on their own phone, where neighbourhood is never used. This check happens on the phone, and the zones are never uploaded.
5. **Never for class hunts.** Neighbourhood sharing is unavailable while a class hunt is active.

## Identity, limits and flags

**Device key.** The app creates a random 256-bit secret on first share and keeps it in IndexedDB. It's sent with each post, and the server stores only its SHA-256 hash. Users have no account and no email, and nothing personal is stored. Losing the phone means starting a new identity, which is acceptable.

**Posting limits**, checked on the server:

| Limit | Value |
|---|---|
| New device (first 24 h) | 3 posts |
| Per device | 3 per 10 minutes, 10 per day |
| Per network (hashed IP with a daily salt; the raw IP is never stored) | 30 posts per day |
| Flags per device | 20 per day |

**Text checks before a post is accepted** (on the phone and on the server):

- length limits (200 characters per field);
- block phone numbers, emails, web addresses and long digit strings, to keep personal information out;
- a blocklist of slurs.

**Flags.**

- Anyone can flag a post: offensive, personal information, spam, or not a typo.
- One flag per device per post.
- **3 flags from different devices hide the post automatically** until reviewed. Flags from devices under a day old count half.

**Review.**

- A private `/admin` page, protected by a secret stored in Vercel's environment settings, lists hidden posts. You choose **Restore** or **Remove**.
- A removal counts as an upheld flag against the poster's device. 3 upheld flags block that device from posting.

**Age.** Sharing requires "I'm 13 or older". Neighbourhood requires 16 or older.

## Data model (Postgres)

```sql
devices (key_hash text primary key, created_at, posts_total int, posts_removed int,
         post_days int, last_upheld_flag_at, banned bool, age16_confirmed bool)

cities  (id int primary key, name, country_code, lat, lon, population)   -- GeoNames subset

posts   (id uuid primary key, device_key_hash → devices, said text, meant text,
         category text, city_id → cities, area_cell text null, area_visible_at timestamptz null,
         read_by_app bool, show_name text null, created_at,
         status text check (status in ('visible','hidden','removed')), flag_weight numeric)

flags   (post_id → posts, device_key_hash, reason text, created_at,
         primary key (post_id, device_key_hash))
```

There are no photos, GPS coordinates, IP addresses or names (unless the poster chooses to show one). That is a few hundred bytes per post, so **free database tiers hold hundreds of thousands of posts**.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/posts` | Create a post (device key in the `Authorization` header) |
| `DELETE` | `/api/posts/:id` | Delete your own post |
| `POST` | `/api/posts/:id/flag` | Flag a post |
| `GET` | `/api/feed?city=<id>&cursor=` | Latest visible posts, 20 per page |
| `GET` | `/api/cities/top` | Cities with the most posts (front page) |
| `GET` | `/city/<slug>` | Server-rendered "Typos in <city>" page, indexable by search engines |
| `GET/POST` | `/api/admin/*` | Review queue (admin secret) |

## Hosting and cost

- **Vercel Hobby (free)** runs the pages and the API. It's for non-commercial use only; if the app ever makes money, move to Pro.
- **Database:** a free serverless Postgres. Two options:
  - **Neon** (via the Vercel marketplace): suspends when idle and wakes on the next request, adding about a second to the first request.
  - **Supabase**: its free projects **pause after a week without activity** and need a manual restore, which is risky for a public site.
  - My recommendation is Neon. Confirm current free limits on both providers' pricing pages before choosing; they change.
- **Expected cost:** $0 while traffic is small. The first thing likely to need paying for is database compute if the site gets busy.

## Front page changes

- A **"Recent typos"** strip, the newest visible posts.
- **"Typos by city"**, the top cities with post counts, linking to `/city/<slug>` pages.
- **Map: not in Phase 2.** Map tiles from OpenStreetMap or Google would add third-party requests, conflicting with the privacy promise and the security policy. City lists first; a self-hosted map can come later if wanted.

## Privacy policy changes (before launch)

- New section on **public posts**: what is shared (text, category, city, optional neighbourhood after 24 h, "Read by app", optional display name), who can see it (everyone), how to delete it, and how flags work.
- The device key: what it is, that only its hash is stored, and that no account exists.
- Hashed network addresses for rate limiting (a daily salt; raw IPs are not stored).
- Retention: removed posts are deleted after 30 days, and flags with them.
- Age: sharing 13+, neighbourhood 16+.
- Change "the app contacts no third parties" to note the app's own server (`/api`), with still no third parties.

## Build plan

| Step | Scope | Estimate |
|---|---|---|
| 1 | Database schema, device keys, `POST/DELETE /api/posts`, limits, text checks | 3–4 days |
| 2 | "Share publicly?" step in the app, city picker (on-device lookup), offline queue | 3 days |
| 3 | Feed API, front-page strip, `/city/<slug>` pages, sitemap of city pages | 3 days |
| 4 | Flags, auto-hide, `/admin` review page, device blocking | 2–3 days |
| 5 | Neighbourhood unlock and its safety rules | 3 days |
| 6 | Privacy policy, help and FAQ updates; tests; security review | 2 days |

## Questions for the owner

1. **Display names on posts:** anonymous only, or let posters opt in to showing their nickname?
2. **Review time:** how quickly can you check hidden posts (daily, weekly)? This decides whether 3 flags should hide a post or only report it.
3. **Languages:** English-only text reading for now, or add other languages' models later (about 2–4 MB each, downloaded on demand)?
4. **Database:** OK to use Neon through Vercel (my recommendation), or do you prefer Supabase?
