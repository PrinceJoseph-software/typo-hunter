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

## Reporting problems and ideas

Something broken, confusing or missing? **[Open an issue](https://github.com/PrinceJoseph-software/typo-hunter/issues/new/choose)** and pick a form:

- **Report a problem:** something isn't working, looks wrong, or lost data.
- **Suggest an idea:** a new feature or an improvement.

The forms ask for what happened, the steps to reproduce it, and your device and browser. That's usually all that's needed to fix it. You can also reach the form from inside the app: **Help → Something Wrong? → Report a problem**.

Please don't post photos of people, students' names or other private details in issues.

**Security or privacy problems** should be reported privately instead. See [SECURITY.md](SECURITY.md).

## Ground rules

- Keep it private by design: no tracking, analytics or uploads of users' collections without a clear opt-in.
- Keep it working offline.
- Don't use other companies' names, logos or characters in the app.

See the [development guide](docs/DEVELOPMENT.md) for how the code is organised.
