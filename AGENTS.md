# Repository guidance

- Use pnpm workspaces. Each automation lives under packages/* and deploys independently.
- Keep configuration examples generic. Local account IDs, email addresses and OAuth configuration belong in ignored wrangler.local.jsonc files. Secrets go through Wrangler secret storage.
- Require verified Cloudflare Access identity for all dashboard and API routes. Never introduce a production auth bypass.
- Invoice files go directly from the ingress Worker to Drive. Durable Objects store metadata and job state, never file bytes. No R2 dependency.
- Monetary values need explicit currency and missing-value handling. Never sum different currencies together.
- Retry external writes with stable identifiers or documented reconciliation. Test failure and duplicate-delivery paths.
- Before publishing changes, run pnpm check, pnpm lint, pnpm test, pnpm build and pnpm format:check.
- Never use real invoices or credentials as committed test fixtures.
