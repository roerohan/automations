# Automations

Small, self-hosted automations for Cloudflare. Each package is an independent Worker with its own configuration, deployment, and documentation.

| Automation                                          | What it does                                                                                                                                       | Status        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| [Invoice categorizer](packages/invoice-categorizer) | Receives forwarded receipts and PDF invoices, stores originals in Google Drive, extracts expenses with Workers AI, and exports to Sheets on demand | Early preview |

## Workspace

Requires Node.js 22.12+ and pnpm 10. Enable pnpm with `corepack enable` if needed.

```sh
pnpm install
pnpm check
pnpm lint
pnpm test
pnpm build
```

Packages live under `packages/*`. Deploy one without deploying the others:

```sh
pnpm --filter @automations/invoice-categorizer deploy
```

Read the [invoice deployment guide](packages/invoice-categorizer/README.md) before deploying. The checked-in Wrangler configuration contains placeholders and denies dashboard access until configured.

## Give this prompt to your agent

```text
Set up the invoice categorizer from https://github.com/roerohan/automations
in my Cloudflare account. Read AGENTS.md and packages/invoice-categorizer/README.md.

Use my authenticated Wrangler CLI. Discover the account and workers.dev subdomain.
Ask me for my owner email and invoice receiving address if they are unknown.
Create an ignored wrangler.local.jsonc configuration, preserving the public template.
Configure a Cloudflare Access application and an exact owner-email allow policy.
Set its audience and team domain in the Worker configuration. If my credentials
cannot manage Access, explain the exact missing setup and keep the Worker locked.
Build, test, and deploy only @automations/invoice-categorizer. Confirm anonymous
requests to the dashboard and API are blocked. Configure an exact Email Routing
rule for the receiving address without replacing existing MX records or routes.

Walk me through creating a Google OAuth web client with Drive and Sheets APIs
enabled. Add GOOGLE_CLIENT_SECRET using wrangler secret put; never commit it.
Set GOOGLE_CLIENT_ID and register APP_URL/api/google/callback as the redirect URI.
If I do not have Google credentials yet, leave that connection pending. Do not
weaken authentication to work around missing configuration. Report the Worker
URL, routing status, and any remaining manual setup.
```

Wrangler access covers Worker deployment and Email Routing when the login has the required scopes. Access administration can require additional permissions or Zero Trust setup. Google OAuth requires a separate Google Cloud project and owner consent.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the [MIT license](LICENSE). This project is an early preview. OCR, receipt photos, scheduled exports, and Ramp reimbursements are future work.
