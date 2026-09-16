import { Parser } from "htmlparser2";
import type { EmailBody } from "./email-body";

export interface ReceiptLink {
  url: string;
  label: string;
}
const relevant = /\b(receipt|invoice|download|bill|pdf)\b/i;
const unrelated = /\b(unsubscribe|privacy|terms|preferences|help|support)\b/i;
/** Extract links, never fetch them. Preserve signed query strings exactly. */
export function receiptLinks(email: EmailBody): ReceiptLink[] {
  const links: ReceiptLink[] = [];
  const seen = new Set<string>();
  function add(href: string, label: string) {
    if (links.length >= 5 || href.length > 4096) return;
    const raw = href.trim();
    if (/[\p{Cc}\p{Cf}\s]/u.test(raw)) return;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return;
    }
    if (url.protocol !== "https:" || url.username || url.password) return;
    const text = label.replace(/\s+/g, " ").trim().slice(0, 160);
    if (
      unrelated.test(text) ||
      !relevant.test(text || `${url.pathname}${url.search}`)
    )
      return;
    if (seen.has(raw)) return;
    seen.add(raw);
    links.push({ url: raw, label: text || "Download receipt" });
  }
  if (email.html && email.html.length <= 1_000_000) {
    let anchor: { href: string; label: string } | undefined;
    const parser = new Parser(
      {
        onopentag(name, attributes) {
          if (name === "a")
            anchor = {
              href: attributes.href ?? "",
              label: attributes.title ?? "",
            };
        },
        ontext(text) {
          if (anchor) anchor.label = (anchor.label + " " + text).slice(0, 500);
        },
        onclosetag(name) {
          if (name === "a" && anchor) {
            add(anchor.href, anchor.label);
            anchor = undefined;
          }
        },
      },
      { decodeEntities: true },
    );
    parser.end(email.html);
  }
  for (const match of (email.text ?? "")
    .slice(0, 60_000)
    .matchAll(/https:\/\/[^\s<>"']+/gi)) {
    const url = match[0].replace(/[),.;]+$/, "");
    const lineStart = (email.text ?? "").lastIndexOf("\n", match.index) + 1;
    const label = (email.text ?? "")
      .slice(Math.max(lineStart, match.index - 100), match.index)
      .trim();
    add(url, relevant.test(label) ? label : "");
  }
  return links;
}
