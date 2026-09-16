import { expect, it } from "vitest";
import { receiptLinks } from "../src/server/receipt-links";

it("keeps signed download URLs and nested link labels without fetching them", () => {
  expect(
    receiptLinks({
      html: '<a href="https://cab.example/receipt?token=abc%2Fdef&amp;id=12"><b>Download</b> tax invoice</a>',
    }),
  ).toEqual([
    {
      url: "https://cab.example/receipt?token=abc%2Fdef&id=12",
      label: "Download tax invoice",
    },
  ]);
});
it("ignores unsafe schemes, credentials and unrelated links", () => {
  expect(
    receiptLinks({
      html: '<a href="javascript:alert(1)">Receipt</a><a href="http://cab.example/invoice">Invoice</a><a href="https://user:password@cab.example/invoice">Download</a><a href="https://cab.example/receipt/unsubscribe">Unsubscribe</a><a href="/relative">Receipt</a>',
    }),
  ).toEqual([]);
});
it("finds plain-text receipts, removes duplicates and limits results", () => {
  const url = "https://cab.example/receipt?token=abc";
  expect(
    receiptLinks({
      html: `<a href="${url}">Receipt</a>`,
      text: `Download receipt: ${url}`,
    }),
  ).toHaveLength(1);
  expect(
    receiptLinks({
      text: `Download: https://cab.example/opaque\nSupport: https://cab.example/help`,
    }),
  ).toEqual([{ url: "https://cab.example/opaque", label: "Download:" }]);
  expect(
    receiptLinks({
      html: Array.from(
        { length: 10 },
        (_, i) => `<a href="https://cab.example/${i}">Receipt</a>`,
      ).join(""),
    }),
  ).toHaveLength(5);
});
