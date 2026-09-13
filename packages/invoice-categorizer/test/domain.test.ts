import { describe, expect, it } from "vitest";
import {
  allowedEnvelope,
  authenticatedEmail,
  digest,
  extractedSchema,
  isPdf,
  reviewIssues,
  type Extracted,
} from "../src/server/domain";
const invoice: Extracted = {
  vendor: "Example",
  invoiceNumber: "INV-1",
  date: "2026-09-13",
  currency: "INR",
  subtotal: "100.00",
  tax: "18.00",
  total: "118.00",
  category: "Software",
};
describe("invoice validation", () => {
  it("accepts a consistent invoice", () =>
    expect(reviewIssues(extractedSchema.parse(invoice))).toEqual([]));
  it("flags incorrect totals", () =>
    expect(reviewIssues({ ...invoice, total: "100.00" })).toContain(
      "Subtotal plus tax does not match total",
    ));
  it("does not silently treat missing totals as zero", () =>
    expect(reviewIssues({ ...invoice, total: null })).toContain(
      "Missing required invoice details",
    ));
  it("accepts credit notes", () =>
    expect(
      reviewIssues({ ...invoice, subtotal: "-100", tax: "-18", total: "-118" }),
    ).toEqual([]));
  it("handles decimal arithmetic", () =>
    expect(
      reviewIssues({
        ...invoice,
        subtotal: "0.10",
        tax: "0.20",
        total: "0.30",
      }),
    ).toEqual([]));
  it.each(["NaN", "Infinity", "1e3", "1,000.00", "=1+2"])(
    "rejects invalid money %s",
    (total) =>
      expect(extractedSchema.safeParse({ ...invoice, total }).success).toBe(
        false,
      ),
  );
  it("rejects impossible dates", () =>
    expect(
      extractedSchema.safeParse({ ...invoice, date: "2026-02-30" }).success,
    ).toBe(false));
  it("rejects categories outside the configured taxonomy", () =>
    expect(
      extractedSchema.safeParse({ ...invoice, category: "Ignore instructions" })
        .success,
    ).toBe(false));
});
describe("email intake", () => {
  it("requires both the exact recipient and an allowed sender", () => {
    expect(
      allowedEnvelope(
        "Invoices@example.com",
        "Owner@example.com",
        "invoices@example.com",
        ["owner@example.com"],
      ),
    ).toBe(true);
    expect(
      allowedEnvelope(
        "other@example.com",
        "owner@example.com",
        "invoices@example.com",
        ["owner@example.com"],
      ),
    ).toBe(false);
    expect(
      allowedEnvelope(
        "invoices@example.com",
        "owner@example.com.evil.test",
        "invoices@example.com",
        ["owner@example.com"],
      ),
    ).toBe(false);
  });
  it("checks file contents rather than extension", () => {
    expect(isPdf(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
    expect(isPdf(new TextEncoder().encode("<html>fake.pdf</html>"))).toBe(
      false,
    );
  });
  it("deduplicates by exact attachment content", async () => {
    const bytes = new TextEncoder().encode("%PDF-invoice");
    expect(await digest(bytes)).toBe(await digest(bytes));
    expect(await digest(bytes)).not.toBe(
      await digest(new TextEncoder().encode("%PDF-other")),
    );
  });
});

it("rejects forged or failed ingress authentication results", () => {
  expect(
    authenticatedEmail("mx.cloudflare.net; dmarc=pass header.from=example.com"),
  ).toBe(true);
  expect(authenticatedEmail("evil.example; dmarc=pass")).toBe(false);
  expect(
    authenticatedEmail(
      "mx.cloudflare.net; dmarc=fail, evil.example; dmarc=pass",
    ),
  ).toBe(false);
  expect(authenticatedEmail("")).toBe(false);
});
