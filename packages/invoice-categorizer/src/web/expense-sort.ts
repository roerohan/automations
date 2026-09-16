import type { Expense } from "../server/domain";

export const expenseColumns = [
  { key: "expense", label: "Expense" },
  { key: "date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
  { key: "original", label: "Original" },
] as const;
export type ExpenseSort = {
  key: (typeof expenseColumns)[number]["key"];
  direction: "ascending" | "descending";
};
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
function value(
  expense: Expense,
  key: ExpenseSort["key"],
): string | number | null {
  switch (key) {
    case "expense":
      return expense.fields?.vendor ?? expense.filename;
    case "date":
      return expense.fields?.date ?? expense.receivedAt.slice(0, 10);
    case "category":
      return expense.fields?.category ?? null;
    case "status":
      return expense.status;
    case "original":
      return expense.receiptLinks?.length
        ? "Download receipt"
        : expense.driveId
          ? expense.source === "email"
            ? "View email"
            : "View PDF"
          : "Pending";
    case "amount": {
      const total = expense.fields?.total;
      return total != null &&
        expense.fields?.currency &&
        Number.isFinite(Number(total))
        ? Number(total)
        : null;
    }
  }
}
export function sortExpenses(
  expenses: Expense[],
  sort: ExpenseSort,
): Expense[] {
  const direction = sort.direction === "ascending" ? 1 : -1;
  return [...expenses].sort((a, b) => {
    const left = value(a, sort.key);
    const right = value(b, sort.key);
    // Unknown values stay at the bottom in either direction.
    if (left === null || right === null)
      return left === right ? 0 : left === null ? 1 : -1;
    if (sort.key === "amount") {
      // Keep currencies together rather than imply an exchange-rate comparison.
      const currency = collator.compare(
        a.fields!.currency!,
        b.fields!.currency!,
      );
      if (currency) return currency;
    }
    return (
      direction *
      (typeof left === "number" && typeof right === "number"
        ? left - right
        : collator.compare(String(left), String(right)))
    );
  });
}
