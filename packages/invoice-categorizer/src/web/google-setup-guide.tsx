export function GoogleSetupGuide({ configured }: { configured: boolean }) {
  const callbackUrl = `${window.location.origin}/api/google/callback`;
  return (
    <details className="google-setup-guide" open={!configured}>
      <summary>Google OAuth setup guide</summary>
      <p>
        Complete this once before connecting Google. Your Cloudflare Access
        login verifies your identity; Google also needs permission to store
        invoice files and update your spreadsheet.
      </p>
      <ol>
        <li>
          <strong>Select a Google Cloud project and enable the APIs.</strong>
          <p>
            Open the{" "}
            <a
              href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
              target="_blank"
              rel="noreferrer"
            >
              Google Drive API
            </a>{" "}
            and{" "}
            <a
              href="https://console.cloud.google.com/apis/library/sheets.googleapis.com"
              target="_blank"
              rel="noreferrer"
            >
              Google Sheets API
            </a>{" "}
            pages. Select the same project on each page and click Enable.
          </p>
        </li>
        <li>
          <strong>Configure the consent screen.</strong>
          <p>
            In{" "}
            <a
              href="https://console.cloud.google.com/auth/branding"
              target="_blank"
              rel="noreferrer"
            >
              Google Auth Platform
            </a>
            , add the app name and contact email. Under{" "}
            <a
              href="https://console.cloud.google.com/auth/audience"
              target="_blank"
              rel="noreferrer"
            >
              Audience
            </a>
            , choose the appropriate audience and add your Google account as a
            test user if the app is External and in Testing. External Testing
            grants normally expire after seven days for file access. Use In
            production for ongoing automation, following Google's requirements.
          </p>
          <p>
            Under{" "}
            <a
              href="https://console.cloud.google.com/auth/scopes"
              target="_blank"
              rel="noreferrer"
            >
              Data access
            </a>
            , add <code>https://www.googleapis.com/auth/drive.file</code>. This
            app requests access to its own files, including its spreadsheet.
          </p>
        </li>
        <li>
          <strong>Create a Web application OAuth client.</strong>
          <p>
            Open{" "}
            <a
              href="https://console.cloud.google.com/auth/clients"
              target="_blank"
              rel="noreferrer"
            >
              OAuth clients
            </a>
            , create a client with application type Web application, and add
            this exact Authorized redirect URI:
          </p>
          <code className="setup-value">{callbackUrl}</code>
          <p>
            You can reuse the project used for Cloudflare Access. A separate
            client keeps these credentials independent. If reusing an existing
            web client, add this URI while keeping all existing redirect URIs
            and credentials intact.
          </p>
        </li>
        <li>
          <strong>Add the credentials to your Worker and redeploy.</strong>
          <p>
            In <code>packages/invoice-categorizer/wrangler.local.jsonc</code>,
            set <code>vars.GOOGLE_CLIENT_ID</code> to the client ID and{" "}
            <code>vars.APP_URL</code> to <code>{window.location.origin}</code>.
            From your repository, run:
          </p>
          <pre>
            <code>{`cd packages/invoice-categorizer\npnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.local.jsonc\npnpm deploy:local`}</code>
          </pre>
          <p>
            Paste the client secret only at Wrangler's secret prompt. Keep it
            out of source control. The command uses your ignored local
            deployment configuration.
          </p>
        </li>
        <li>
          <strong>Refresh this page and click Connect Google.</strong>
          <p>
            Choose the Google account that will own your invoices and approve
            file access. Once connected, you can send invoices and use Sync to
            Sheets. Reconnect if Google expires or revokes the grant.
          </p>
        </li>
      </ol>
      <p>
        <a
          href="https://github.com/roerohan/automations/tree/main/packages/invoice-categorizer#google-oauth"
          target="_blank"
          rel="noreferrer"
        >
          Repository deployment guide
        </a>
      </p>
    </details>
  );
}
