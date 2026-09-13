# Contributing

Open an issue describing the problem or proposed automation before a large change. Small fixes can go straight to a pull request.

Use Node.js 22.12+ and the pnpm version in package.json. Run `pnpm install`, then `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm format:check` before submitting.

Keep each automation independently deployable under `packages/*`. Give it its own README, Wrangler configuration, tests, and package scripts. Share code only after multiple packages need it. Keep personal deployment configuration, tokens, invoice samples, and account data out of commits.

Changes to authentication, intake, monetary values, retries, or persistence need regression tests. UI changes should work on narrow screens and with keyboard navigation. Document configuration changes and migration implications. Do not deploy a contributor's changes to someone else's account as part of a pull request.

By contributing, you agree that your contribution is licensed under the repository's MIT license. Be respectful, specific, and constructive in issues and reviews.
