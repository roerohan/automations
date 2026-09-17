import { afterEach, expect, it, vi } from "vitest";
import {
  allowedReceiptUrl,
  boundedPdf,
  downloadReceipt,
} from "../src/server/receipt-download";
afterEach(() => vi.unstubAllGlobals());
it("only allows exact HTTPS vendor hosts", () => {
  expect(
    allowedReceiptUrl("https://tracking.ibt.uber.com/receipt?id=abc"),
  ).toBe(true);
  for (const url of [
    "https://127.0.0.1/a",
    "https://uber.com.attacker.test/a",
    "http://uber.com/a",
    "https://user:pass@uber.com/a",
    "https://uber.com:8443/a",
    "https://unknown.example/a",
  ])
    expect(allowedReceiptUrl(url)).toBe(false);
});
it("does not follow redirects to untrusted hosts", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { location: "https://127.0.0.1/private" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(
    await downloadReceipt([
      { url: "https://riders.uber.com/receipt", label: "Receipt" },
    ]),
  ).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("keeps login pages as links instead of saving HTML", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("Sign in", { headers: { "Content-Type": "text/html" } }),
      ),
  );
  expect(
    await downloadReceipt([
      { url: "https://riders.uber.com/receipt", label: "Receipt" },
    ]),
  ).toBeUndefined();
});
it("downloads a PDF without sending credentials", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response("%PDF-example", {
      headers: { "Content-Type": "application/pdf" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const bytes = await downloadReceipt([
    { url: "https://riders.uber.com/receipt", label: "Receipt" },
  ]);
  expect(new TextDecoder().decode(bytes)).toBe("%PDF-example");
  expect(fetcher.mock.calls[0]![1].headers).toEqual({
    Accept: "application/pdf",
  });
});
it("rejects non-PDF and oversized bodies", async () => {
  await expect(boundedPdf(new Response("HTML"))).rejects.toThrow();
  await expect(
    boundedPdf(
      new Response("%PDF-", { headers: { "Content-Length": "8388609" } }),
    ),
  ).rejects.toThrow();
});
