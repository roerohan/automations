import { describe, expect, it } from "vitest";
import PostalMime from "postal-mime";
import { receiptBody, bodyExpenseId } from "../src/server/email-body";

describe("forwarded receipt bodies", () => {
  it("reads HTML-only receipts without scripts, images, or remote URLs", () => {
    const text = receiptBody({
      subject: "Fwd: Your ride",
      html: '<style>secret-style</style><script>secret-script</script><h1>Example Cab receipt</h1><table><tr><td>Total</td><td>INR 118.00</td></tr></table><p>Date: 2026-09-13</p><img src="https://tracker.invalid/pixel"><a href="https://tracker.invalid/click">Thanks for riding</a>',
    });
    expect(text).toContain("INR 118.00");
    expect(text).toContain("2026-09-13");
    expect(text).not.toMatch(/tracker|secret-script|secret-style/);
  });
  it("prefers the plain alternative and retains quoted receipt details", () => {
    const text =
      "---------- Forwarded message ----------\nExample Cab receipt\nDate 2026-09-13\nTotal INR 118.00";
    expect(
      receiptBody({
        subject: "Receipt",
        text,
        html: "<p>Different content</p>",
      }),
    ).toContain(text);
  });
  it("rejects image-only and oversized receipts instead of guessing", () => {
    expect(() => receiptBody({ html: '<img src="cid:receipt">' })).toThrow(
      "No readable",
    );
    expect(() => receiptBody({ text: "x".repeat(60_001) })).toThrow("too long");
  });
  it("ignores delivery headers and whitespace in duplicate detection", async () => {
    const body = "Example Cab receipt\nDate 2026-09-13\nTotal INR 118.00";
    const parse = async (id: string) =>
      receiptBody(
        await PostalMime.parse(
          `From: owner@example.com\r\nSubject: Receipt\r\nMessage-ID: <${id}>\r\nContent-Type: text/plain\r\n\r\n${body}`,
        ),
      );
    expect(await bodyExpenseId(await parse("one"))).toBe(
      await bodyExpenseId(await parse("two")),
    );
    expect(await bodyExpenseId(body)).toBe(
      await bodyExpenseId(body.replace(/\n/g, "  ")),
    );
    expect(await bodyExpenseId(body)).not.toBe(
      await bodyExpenseId(body.replace("118.00", "119.00")),
    );
  });
});
