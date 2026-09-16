import { expect, it } from "vitest";
import type { Expense } from "../src/server/domain";
import { sortExpenses } from "../src/web/expense-sort";
function expense(id: string, total: string | null, currency = "USD"): Expense {
  return {
    id,
    filename: `${id}.pdf`,
    receivedAt: "2026-09-16T00:00:00Z",
    sender: "test@example.com",
    status: "ready",
    issues: [],
    attempts: 0,
    fields: {
      vendor: id,
      date: null,
      category: "Other",
      total,
      currency,
      subtotal: null,
      tax: null,
      invoiceNumber: null,
    },
  };
}
it("sorts numeric amounts with missing values last in both directions, without mutating records", () => {
  const rows = [
    expense("missing", null),
    expense("large", "100"),
    expense("small", "9"),
  ];
  expect(
    sortExpenses(rows, { key: "amount", direction: "ascending" }).map(
      (x) => x.id,
    ),
  ).toEqual(["small", "large", "missing"]);
  expect(
    sortExpenses(rows, { key: "amount", direction: "descending" }).map(
      (x) => x.id,
    ),
  ).toEqual(["large", "small", "missing"]);
  expect(rows.map((x) => x.id)).toEqual(["missing", "large", "small"]);
});
it("groups currencies rather than comparing their face values", () => {
  const rows = [expense("usd", "2"), expense("inr", "1000", "INR")];
  expect(
    sortExpenses(rows, { key: "amount", direction: "ascending" }).map(
      (x) => x.id,
    ),
  ).toEqual(["inr", "usd"]);
});
it("uses received date when invoice date is unavailable and keeps ties stable", () => {
  const older = expense("older", "2");
  older.fields!.date = "2026-09-01";
  const rows = [older, expense("first", "2"), expense("second", "2")];
  expect(
    sortExpenses(rows, { key: "date", direction: "descending" }).map(
      (x) => x.id,
    ),
  ).toEqual(["first", "second", "older"]);
});
