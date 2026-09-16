import { convert } from "html-to-text";
import { digest } from "./domain";

export interface EmailBody {
  subject?: string;
  text?: string;
  html?: string;
}
export const MAX_BODY_TEXT = 60_000;
/** No remote resources are loaded, and HTML is never rendered in the dashboard. */
export function receiptBody(email: EmailBody): string {
  const plain = email.text?.trim() ?? "";
  const html = email.html ?? "";
  if (html.length > 1_000_000)
    throw new Error("Email body is too large. Attach a PDF instead.");
  const body =
    plain.length >= 40
      ? plain
      : convert(html, {
          wordwrap: false,
          limits: {
            maxInputLength: 1_000_000,
            maxDepth: 100,
            ellipsis: "[TRUNCATED]",
          },
          selectors: [
            { selector: "img", format: "skip" },
            { selector: "script", format: "skip" },
            { selector: "style", format: "skip" },
            { selector: "a", options: { ignoreHref: true } },
          ],
        }).trim() || plain;
  if (body.includes("[TRUNCATED]"))
    throw new Error("Email body is too complex. Attach a PDF instead.");
  if (body.length < 40)
    throw new Error(
      "No readable receipt text. Forward the full receipt or attach a PDF.",
    );
  const result = `Subject: ${(email.subject ?? "Receipt").slice(0, 500)}\n\n${body}`;
  if (result.length > MAX_BODY_TEXT)
    throw new Error("Email body is too long. Attach a PDF instead.");
  return result;
}
export function bodyExpenseId(text: string): Promise<string> {
  // Ignore delivery headers and insignificant whitespace; preserve receipt content.
  return digest(
    new TextEncoder().encode(
      `email-body:v1\n${text.normalize("NFKC").replace(/\s+/g, " ").trim()}`,
    ),
  );
}
