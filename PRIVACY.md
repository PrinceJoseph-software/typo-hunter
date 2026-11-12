# Privacy Policy

**Effective date:** 12 November 2026 (updated to cover optional public posts, the public nickname, city lookup and more reading languages)

Typo Hunter is a web app for photographing and collecting language mistakes. It is designed so that **your collection stays on your device**. This policy explains what the app stores, what leaves your device, and what choices you have.

## The short version

- No accounts, no sign-up, no passwords.
- No analytics, no advertising, no tracking cookies.
- Your photos, notes and scores are stored only in your browser on your device.
- Nothing is shared with anyone unless *you* show a QR code, send a file, or choose to post a find's words publicly.
- Public posts are optional and contain words only: never your photo or exact location.

## What is stored on your device

The app uses your browser's built-in storage (IndexedDB and local storage) on your own device:

| Data | Why |
|---|---|
| Photos you capture (a full-size copy and a small thumbnail) | To build your collection |
| What you type: titles, wording, corrections, locations, notes | To describe each find |
| Text the app read from your photo | To fill in the wording and show the "Read by app" badge |
| Ratings, favourites and Legends picks | Your personal curation |
| Your locked points | Your score |
| Your display name and squad | Shown on your pass and results |
| A random device ID | To tell players and students apart when names are the same |
| Battle history, class rosters (teachers only), settings | To make those features work |
| The time of your last capture | For the mascot and reminders |

This data is not sent to us or to any server we run. We have no copy of it.

**Location:** The "location" field on a find is text you type yourself and stays on your phone. The app only asks for your device's location if you tap **Use my location** while choosing a city for a public post. Your position is compared with a list of cities **on your phone** and is never sent anywhere; only the city you pick is shared.

## What leaves your device, and when

Data leaves your device only in these cases:

1. **QR codes you choose to show.** Your Curator Pass contains your display name, squad, rank, points, number of finds, the title and rating of your best find, and your random device ID. Speed Blitz and class codes contain your name, score and device ID. Anyone who scans your screen can read this.
2. **Files you choose to share.** A backup file contains your whole collection, including photos. A class review file contains the photos you took during that class. You decide where these go (for example AirDrop, email or a USB stick).
3. **Share cards.** If you share a find, the image card goes wherever you send it.
4. **Loading the app.** Like any website, the server that delivers the app (our hosting provider) receives standard technical information, such as your IP address and browser type, when you open or update it online. That request never includes your photos or collection.

**No third parties.** Everything the app needs, including its fonts, is delivered from the app's own site. It makes no requests to Google, advertising networks, analytics services or any other third party. Public posts go only to this app's own server. Once it has been opened, everything except public posts works without a connection.

## Camera, text reading and notifications

- **Camera:** used only when you take a photo or scan a QR code. Images from the camera are processed on your device.
- **Text reading:** the app reads the text in your photo **on your phone**, in the language you choose (English, French, Spanish, Portuguese, German, Italian, Arabic, Hindi or Chinese). The first time you use a language, its reading files (a few MB) download from this app's own site, then work offline. Your photo is never sent anywhere to be read. The text it finds is saved with your find, and a find whose wording matches it is marked "Read by app". That badge means the app read it on your phone; it isn't proof.
- **Notifications:** off unless you turn them on. Reminders are created on your device. On some browsers they are scheduled by your browser's background sync. No push service or third-party notification server is used.

## Public posts (optional)

You can choose, find by find, to share a typo on the public feed. Nothing is posted unless you tick **Let everyone see it?** or tap **Share publicly**.

**What becomes public:** what the sign said, what it meant, the category, the **city** you picked, the "Read by app" label, the date, and your public nickname if you choose to show it. Anyone can read it on this site, and search engines may index it.

**What is never sent:** your photo, your exact location, the notes and location text on your find, your private display name.

**What our server stores** (the app's own server on this site; no third parties):

| Data | Why |
|---|---|
| The post itself (text, category, city, date) | To show it |
| A scrambled (hashed) copy of a random key kept on your phone | To let you delete your posts and to apply posting limits. It isn't an account and contains nothing about you |
| Your public nickname, if you claim one | To show it on posts you choose, and to stop others using it or a look-alike |
| Flags on a post (reason and a scrambled key of the person flagging) | To hide posts several people report |
| A scrambled, daily-changing code derived from your network address | To limit how many posts one network can send per day. The address itself is not stored, and these codes are deleted within 2 days |

The database is hosted by our providers (Vercel for the site, Neon for the database), who process it on our behalf.

**Your controls:** remove any of your public posts from the find's page in the app; it is deleted from the server straight away. Posts removed by a moderator are deleted after 30 days. If you clear the app's data or lose your phone, you lose the key and can no longer delete old posts yourself: open an issue (see Contact) and we'll remove them.

**Rules:** don't post names, phone numbers, addresses or other personal details (the app blocks the obvious ones). Anyone can flag a post; posts flagged by several people are hidden until reviewed. You must be **13 or older** to post publicly, and public posting is switched off during class hunts.

## Children and classrooms

Typo Hunter collects no personal information on any server, so we do not knowingly collect children's data. When a class uses Typo Hunter:

- Students' work stays on their own devices until they hand in a review file or show a QR code to their teacher.
- The teacher's class list (names, scores, approved photos) is stored only on the teacher's device.
- Schools and teachers are responsible for following their own data-protection rules for any files students hand in.

## Keeping and deleting your data

- Your data stays on your device until you delete it.
- You can delete individual finds in the app, or remove everything by clearing this site's data in your browser settings.
- **Clearing site data or losing your device deletes your collection permanently** unless you have exported a backup. We cannot recover it, because we never had it.

## Security

Backup files include a checksum that detects accidental damage. It is not a security seal: a determined person can edit a file. Keep your backups somewhere safe, as you would your photos.

## Changes to this policy

If the app changes in a way that affects your privacy, for example by adding an optional online sync, this policy will be updated before that feature ships, and the effective date above will change.

## Contact

Questions about privacy? [Open an issue](https://github.com/PrinceJoseph-software/typo-hunter/issues/new/choose) on the project's GitHub repository. The same policy is shown inside the app under **Help → Privacy**.
