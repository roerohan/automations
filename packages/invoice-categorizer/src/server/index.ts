import PostalMime from "postal-mime";
import { receiptBody, bodyExpenseId } from "./email-body";
import { authorize, sameOrigin } from "./auth";
import {
  allowedEnvelope,
  authenticatedEmail,
  digest,
  isPdf,
  MAX_PDF_BYTES,
  folderSelectionSchema,
  folderCreationSchema,
} from "./domain";
import type { Env } from "./env";
import {
  createDriveFile,
  GOOGLE_SCOPES,
  tokenRequest,
  FolderError,
} from "./google";
export { InvoiceLedger } from "./ledger";

function ledger(env: Env) {
  return env.LEDGER.get(env.LEDGER.idFromName("owner"));
}
const cookie = (value: string, maxAge: number) =>
  `invoice_oauth=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!(await authorize(request, env)))
      return new Response(
        "Owner access required. Configure Cloudflare Access for this application.",
        { status: 403 },
      );
    const url = new URL(request.url);
    if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request, env))
      return json({ error: "Invalid request origin." }, 403);
    const store = ledger(env);
    try {
      if (url.pathname === "/api/dashboard" && request.method === "GET")
        return json(await store.dashboard());
      if (url.pathname === "/api/google/picker" && request.method === "POST")
        return json(await store.pickerSession());
      if (url.pathname === "/api/folder" && request.method === "PUT") {
        const input = folderSelectionSchema.parse(await request.json());
        const result = await store.selectFolder(input.folderId);
        return json(result, "error" in result ? 400 : 200);
      }
      if (url.pathname === "/api/folder" && request.method === "POST") {
        const result = await store.createFolder(
          folderCreationSchema.parse(await request.json()),
        );
        return json(result, "error" in result ? 400 : 200);
      }
      if (url.pathname === "/api/google/connect" && request.method === "POST") {
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
          return json(
            {
              error:
                "Configure Google OAuth credentials first. See the deployment guide.",
            },
            409,
          );
        const state = crypto.randomUUID();
        const verifier = `${crypto.randomUUID()}${crypto.randomUUID()}`;
        await store.saveOAuth(state, verifier);
        const challengeBytes = new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(verifier),
          ),
        );
        const challenge = btoa(String.fromCharCode(...challengeBytes))
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replaceAll("=", "");
        const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        target.search = new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          redirect_uri: `${env.APP_URL}/api/google/callback`,
          response_type: "code",
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
          state,
          code_challenge: challenge,
          code_challenge_method: "S256",
        }).toString();
        return Response.json(
          { url: target.toString() },
          {
            headers: {
              "Set-Cookie": cookie(state, 600),
              "Cache-Control": "no-store",
            },
          },
        );
      }
      if (url.pathname === "/api/google/callback" && request.method === "GET") {
        const state = url.searchParams.get("state");
        const savedCookie = request.headers
          .get("Cookie")
          ?.split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith("invoice_oauth="))
          ?.slice("invoice_oauth=".length);
        if (!state || savedCookie !== state)
          return json(
            { error: "Invalid authorization state. Start again." },
            400,
          );
        const saved = await store.consumeOAuth(state);
        const code = url.searchParams.get("code");
        if (!saved || !code)
          return json(
            { error: "Authorization expired or was declined. Start again." },
            400,
          );
        const result = await tokenRequest(env, {
          grant_type: "authorization_code",
          code,
          code_verifier: saved.verifier,
          redirect_uri: `${env.APP_URL}/api/google/callback`,
        });
        if (!result.refresh_token)
          throw new Error(
            "Google did not grant offline access. Reconnect and approve access.",
          );
        await store.connectGoogle(result.refresh_token);
        return new Response(null, {
          status: 303,
          headers: {
            Location: env.APP_URL,
            "Set-Cookie": cookie("", 0),
            "Cache-Control": "no-store",
          },
        });
      }
      if (
        url.pathname === "/api/google/disconnect" &&
        request.method === "POST"
      ) {
        await store.disconnect();
        return json({ ok: true });
      }
      if (url.pathname === "/api/sync" && request.method === "POST")
        return json(await store.syncSheets());
      if (
        ["/api/retry", "/api/rename"].includes(url.pathname) &&
        request.method === "POST"
      ) {
        const input = (await request.json()) as { id?: unknown };
        if (typeof input.id !== "string" || !/^[a-f0-9]{64}$/.test(input.id))
          return json({ error: "Invalid expense ID." }, 400);
        if (url.pathname === "/api/rename") await store.renameExpense(input.id);
        else await store.retry(input.id);
        return json({ ok: true });
      }
      if (url.pathname.startsWith("/api/"))
        return json({ error: "Not found." }, 404);
      const asset = await env.ASSETS.fetch(request);
      const response = new Response(asset.body, asset);
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set(
        "Referrer-Policy",
        "strict-origin-when-cross-origin",
      );
      response.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' https://apis.google.com; frame-src https://docs.google.com https://drive.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      return response;
    } catch (error) {
      if (error instanceof FolderError)
        return json({ error: error.message }, 400);
      return json(
        {
          error:
            "The operation failed. Check your settings and Google connection, then retry.",
        },
        400,
      );
    }
  },
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    if (
      !allowedEnvelope(
        message.to,
        message.from,
        env.INVOICE_EMAIL,
        env.ALLOWED_SENDERS,
      )
    ) {
      message.setReject("Sender or recipient is not allowed.");
      return;
    }
    // Cloudflare rejects failed sender authentication at routing. Also require its
    // ingress Authentication-Results to attest DMARC for the visible sender.
    const authentication = message.headers.get("Authentication-Results") ?? "";
    if (!authenticatedEmail(authentication)) {
      message.setReject("Authenticated sender required (DMARC).");
      return;
    }
    if (message.rawSize > 12 * 1024 * 1024) {
      message.setReject("Message exceeds the 12 MiB limit.");
      return;
    }
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);
    if (
      !parsed.from?.address ||
      !env.ALLOWED_SENDERS.some(
        (sender) =>
          sender.toLowerCase() === parsed.from!.address!.toLowerCase(),
      )
    ) {
      message.setReject("The From address is not allowed.");
      return;
    }
    const attachments = parsed.attachments.filter(
      (attachment) =>
        attachment.mimeType === "application/pdf" ||
        attachment.filename?.toLowerCase().endsWith(".pdf"),
    );
    if (attachments.length > 5) {
      message.setReject("Send at most five PDF attachments.");
      return;
    }
    if (attachments.length === 0) {
      let text: string;
      try {
        text = receiptBody(parsed);
      } catch (error) {
        message.setReject(
          error instanceof Error
            ? error.message
            : "Cannot read this email body.",
        );
        return;
      }
      const id = await bodyExpenseId(text);
      const filename = `${(parsed.subject ?? "Receipt").replace(/[\p{Cc}/\\]/gu, "_").slice(0, 150)}.eml`;
      const store = ledger(env);
      const reservation = await store.prepareUpload({
        id,
        filename,
        source: "email",
        sender: message.from,
        receivedAt: new Date().toISOString(),
        status: "uploading",
        issues: [],
        attempts: 0,
      });
      if (!reservation) return;
      await createDriveFile(
        reservation.token,
        reservation.driveId,
        filename,
        "message/rfc822",
        reservation.folderId,
        raw,
      );
      await store.finishUpload(id);
      return;
    }
    const valid = attachments.map((attachment) => ({
      attachment,
      bytes:
        typeof attachment.content === "string"
          ? new TextEncoder().encode(attachment.content).buffer
          : new Uint8Array(attachment.content).buffer,
    }));
    if (
      valid.some(
        ({ bytes }) =>
          bytes.byteLength > MAX_PDF_BYTES || !isPdf(new Uint8Array(bytes)),
      )
    ) {
      message.setReject(
        "Each attachment must be a valid PDF of at most 8 MiB.",
      );
      return;
    }
    for (const { attachment, bytes } of valid) {
      const id = await digest(bytes);
      // Strip control characters from untrusted attachment names.
      const filename = (attachment.filename ?? "invoice.pdf")
        .replace(/[\p{Cc}/\\]/gu, "_")
        .slice(0, 180);
      const store = ledger(env);
      const reservation = await store.prepareUpload({
        id,
        filename,
        source: "pdf",
        sender: message.from,
        receivedAt: new Date().toISOString(),
        status: "uploading",
        issues: [],
        attempts: 0,
      });
      if (!reservation) continue;
      await createDriveFile(
        reservation.token,
        reservation.driveId,
        filename,
        "application/pdf",
        reservation.folderId,
        bytes,
      );
      await store.finishUpload(id);
    }
  },
} satisfies ExportedHandler<Env>;
