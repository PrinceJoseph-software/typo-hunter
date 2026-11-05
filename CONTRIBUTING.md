# Contributing

Thanks for your interest in Typo Hunter! Ideas, bug reports and improvements are welcome.

## How changes reach `main`

`main` is protected. Nobody, including maintainers, can push to it directly, force-push it or delete it. Every change goes through a pull request that the project owner reviews and approves before it is merged.

1. **Fork** the repository (or create a branch if you're a collaborator).
2. Make your change on a branch in your fork.
3. Run the checks:
   ```bash
   pnpm install
   pnpm build      # type check + production build
   ```
4. Check your change on a phone-sized screen, since most people use the app on a phone.
5. Open a **pull request to `main`** that explains what changed and why.

The owner will review it, may ask for changes, and merges it once it's been checked.

## Making your own version

Typo Hunter is MIT-licensed, so you're free to fork it and build your own variation: a different theme, a version for one school, another language. You don't need permission. Please keep the licence notice. If you build something you think belongs in the main app, open a pull request.

## Reporting problems

Open an issue that describes:
- what you did,
- what you expected,
- what happened instead,
- your device and browser.

Please don't include photos of people or private information in issues.

## Ground rules

- Keep it private by design: no tracking, analytics or uploads of users' collections without a clear opt-in.
- Keep it working offline.
- Don't use other companies' names, logos or characters in the app.

See the [development guide](docs/DEVELOPMENT.md) for how the code is organised.
