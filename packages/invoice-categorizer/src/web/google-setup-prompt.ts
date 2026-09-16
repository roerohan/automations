/** Contains public setup context only, never credentials or account tokens. */
export function googleSetupPrompt(origin: string): string {
  return `Set up Google Drive, Sheets, and the folder picker for my Invoice Categorizer deployment.

Repository: https://github.com/roerohan/automations
Package: packages/invoice-categorizer
Dashboard origin: ${origin}
Exact OAuth redirect URI: ${origin}/api/google/callback

Do the setup, not just explain it. Inspect the existing checkout, AGENTS.md, package README, scripts, and ignored local deployment configuration first. Use the existing signed-in browser/computer-use session for Google Cloud Console when useful, and Wrangler for Worker configuration and secrets. Ask me only for missing project/account choices, login/MFA, consent, or permissions you genuinely need. Never ask me to paste secrets into chat.

1. Identify the GCP project and Google account intended for this deployment. Reuse the intended project when available. Verify its project ID AND numeric project number; do not confuse the two. Confirm the target Cloudflare account and Worker using the local configuration and wrangler whoami. Preserve existing apps, clients, redirect URIs, secrets, routes, Access policies, and other automations. Do not reset or rotate shared credentials.

2. Enable all three APIs IN THAT SAME GCP PROJECT:
- Drive: https://console.cloud.google.com/apis/library/drive.googleapis.com
- Sheets: https://console.cloud.google.com/apis/library/sheets.googleapis.com
- Picker: https://console.cloud.google.com/apis/library/picker.googleapis.com
Confirm each shows enabled; allowing an OAuth scope does not enable its API.

3. Configure Google Auth Platform branding, audience, and data access:
- https://console.cloud.google.com/auth/branding
- https://console.cloud.google.com/auth/audience
- https://console.cloud.google.com/auth/scopes
Use truthful app/contact details. Request only https://www.googleapis.com/auth/drive.file, as the source currently does. That scope supports this app's own Drive files and spreadsheet; do not broaden to all Drive files or all spreadsheets. For External/Testing, add my Google account as a test user to avoid the access_denied screen. Explain that Testing file-access grants normally expire after seven days; discuss production status and Google's requirements with me before changing the audience/publishing status of an existing shared app.

4. Create a Web application OAuth client at https://console.cloud.google.com/auth/clients (a dedicated client is preferred). Name it appropriately for my automation. Add authorized JavaScript origin ${origin} and exact redirect URI ${origin}/api/google/callback. Preserve all existing entries if I choose to reuse a client. Cloudflare Access login does not grant Drive access; do not extract or replace its identity-provider secret. Local development is optional: inspect the actual dev origin/port, then register its exact http://localhost:PORT origin and /api/google/callback redirect, never guess the port or use HTTPS unless local TLS is configured.

5. At https://console.cloud.google.com/apis/credentials, create a dedicated browser API key for Picker. Restrict its API access to Google Picker API and website referrers to ${origin}/* and https://docs.google.com/*. Add the actual localhost referrer only if needed. Get the numeric project number from https://console.cloud.google.com/home/dashboard. The OAuth client, Picker key, and project number must belong to the same project. The Picker key is browser-visible; the OAuth client secret must remain server-only. Reference: https://developers.google.com/workspace/drive/picker/guides/web-picker

6. Configure these four values without exposing them in chat, logs, shell history, or Git:
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_PICKER_API_KEY
GOOGLE_PROJECT_NUMBER
Preserve unrelated values in the ignored packages/invoice-categorizer/.dev.vars; verify Git ignores it and use owner-only file permissions. Store the deployment values using Wrangler secret bulk with a structured JSON payload via stdin (or secret put with safe interactive input), targeting wrangler.local.jsonc from the package directory. Check the installed Wrangler help for syntax. If moving a name from local vars to secrets, reconcile that duplicate binding without deleting unrelated settings. Never commit credentials or put the OAuth client secret in frontend code. Set APP_URL to ${origin} in the ignored local deployment config. If this origin is localhost, obtain the actual production URL before configuring or deploying the remote Worker.

7. Run the repository's required checks, then deploy only this Worker using the existing deploy:local script so Vite and Wrangler both use the local configuration. Keep Cloudflare Access protection, email routing, Durable Object bindings/data, custom domain, and other Workers intact. Do not deploy the generic template configuration over the personal deployment.

8. Open the deployed dashboard, Connect Google, and let me approve the account/consent step. Verify the folder picker shows My Drive and shared folders; select the folder I want (requires permission to add files), or create a new one if requested. Existing folders/files must not be renamed or moved as part of setup. With my go-ahead, test one clearly labeled synthetic receipt and manual Sync to Sheets; confirm the expense, Drive original, and spreadsheet row. Do not send emails, delete records, or overwrite an existing spreadsheet just to test without my authorization.

Troubleshoot specifically: access_denied in Testing -> check test user; redirect_uri_mismatch -> compare exact scheme/host/port/path; Drive HTTP 403 API disabled -> verify Drive enabled in the OAuth client's project and allow propagation; invalid Picker key -> check API/referrer restrictions including docs.google.com and project number; folder inaccessible -> reselect via Picker and check permission to add files. Do not solve these by disabling Access or granting broader scopes.

Finish with a concise setup report: project ID/number, Worker/dashboard, enabled APIs, credential NAMES configured (never values), checks actually completed, and any remaining owner action. Do not claim a test passed unless you observed it.`;
}
