# Switching on the public typo feed

The code for public posts ships with the site, but it stays **off** until a database is connected. Until then the app works exactly as before, the front page shows "No public typos yet", and sharing a find reports that public posts aren't switched on.

Everything below fits Vercel's free Hobby plan (non-commercial use) and Neon's free database plan. Check both providers' current limits before relying on them.

## One-time setup (about 5 minutes)

1. **Add the database.** In the Vercel dashboard open the project → **Storage** → **Create Database** → **Neon** (Postgres) → choose the free plan → connect it to the project for all environments. Vercel adds a `DATABASE_URL` environment variable for you.
2. **Set an admin secret.** Project → **Settings** → **Environment Variables** → add `ADMIN_SECRET` with a long random value (at least 16 characters; a password manager's generator is ideal). You'll type it on the review page. Keep it private.
3. *(Optional)* add `BLOCKED_WORDS`: a comma-separated list of words that may not appear in posts or nicknames.
4. **Redeploy** (Deployments → the latest one → Redeploy) so the new variables take effect.

The tables are created automatically the first time the site is used. There is nothing to run by hand.

## Check it works

- Open `/api/health` on your site. It should show `{"ok":true}`. (`not_configured` means `DATABASE_URL` isn't set for that deployment.)
- In the app, save a find with **Let everyone see it?** ticked, then look at the front page and at `/city/<your-city>`.

## Reviewing flagged posts

Open **`/admin`** on your site and enter the admin secret.

- A post is hidden automatically once 3 different people flag it (flags from phones less than a day old count half, and several flags from one network count once).
- **Restore** puts a post back and protects it from being hidden again.
- **Remove** deletes it from public view and counts against the poster. After 3 removals that phone can no longer post.

Checking about once a week is enough, because flagged posts are already hidden while they wait.

## Limits built in

| Limit | Value |
|---|---|
| Posts per phone | 3 on the first day, then 10 a day and 3 per 10 minutes |
| Posts per network | 30 a day |
| Flags per phone | 20 a day |
| Nickname changes | once every 30 days, up to 3 names per phone |

These live in `LIMITS` in `server/app.ts`.

## Not built yet

- **Neighbourhood-level location** (the unlock for frequent posters described in `PHASE2_PUBLIC_POSTS.md`). Posts are city-level only for now.
- A sitemap of city pages for search engines.
