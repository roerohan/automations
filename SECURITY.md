# Security

Do not report credentials, private invoices, or exploit details in public issues. Use GitHub private vulnerability reporting for this repository. If unavailable, contact the maintainer through their GitHub profile before sharing sensitive details.

Only the current main branch receives security fixes. This is an early preview, not an audited accounting product.

The dashboard requires an owner identity verified by Cloudflare Access. All static assets pass through the authentication handler. API mutations require the configured same origin; Google authorization uses state and PKCE. Google refresh tokens remain in server-side storage. Untrusted invoice text is input to extraction, never an authorization source or executable command.

Keep Wrangler credentials, OAuth client secrets, refresh tokens, Access cookies, real invoice fixtures, and local configuration out of source control and logs. Do not add an authentication bypass for convenience. Report any route that returns private data without a verified owner identity.
