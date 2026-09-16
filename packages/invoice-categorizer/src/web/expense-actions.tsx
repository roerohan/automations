import { useState } from "react";
import { Button, Dialog, DropdownMenu, Input } from "@cloudflare/kumo";
import { CaretDown, DotsThree } from "@phosphor-icons/react";
import { categories, type Expense } from "../server/domain";

type Props = {
  expense: Expense;
  api: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  refresh: () => Promise<unknown>;
  onNotice: (message: string) => void;
};
export function ExpenseActions({ expense, api, refresh, onNotice }: Props) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mutable = ["ready", "review", "failed"].includes(expense.status);
  const name = expense.fields?.vendor ?? expense.filename;
  function open(kind: "edit" | "delete") {
    setError("");
    setDialog(kind);
  }
  async function save(fields?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/expenses/${expense.id}`,
        fields ? "PATCH" : "DELETE",
        fields,
      );
      setDialog(null);
      onNotice(
        fields
          ? "Expense details saved. Sync to Sheets to update your export."
          : "Expense deleted. The original remains in Drive. Sync to Sheets to update your export.",
      );
      try {
        await refresh();
      } catch {
        onNotice(
          "Your change was saved, but the table could not refresh. Reload this page to see it.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update this expense.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger
          render={<Button size="sm" aria-label={`Actions for ${name}`} />}
        >
          <DotsThree size={22} aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="expense-menu">
          {expense.driveId && (
            <DropdownMenu.LinkItem
              href={`https://drive.google.com/file/d/${expense.driveId}/view`}
              target="_blank"
              rel="noreferrer"
            >
              {expense.source === "email" ? "View original email" : "View PDF"}
            </DropdownMenu.LinkItem>
          )}
          {expense.receiptLinks?.map((link, index) => (
            <DropdownMenu.LinkItem
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
            >
              Download receipt
              {expense.receiptLinks!.length > 1 ? ` ${index + 1}` : ""}
            </DropdownMenu.LinkItem>
          ))}
          <DropdownMenu.Item disabled={!mutable} onClick={() => open("edit")}>
            Edit details
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item disabled={!mutable} onClick={() => open("delete")}>
            Delete expense
          </DropdownMenu.Item>
          {!mutable && (
            <DropdownMenu.Label>Available after processing</DropdownMenu.Label>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
      <Dialog.Root
        open={dialog !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !busy) setDialog(null);
        }}
      >
        <Dialog size="lg" className="expense-dialog">
          <Dialog.Title>
            {dialog === "delete" ? "Delete expense?" : "Edit expense details"}
          </Dialog.Title>
          <Dialog.Description>
            {dialog === "delete"
              ? `Remove ${name} from your expenses and totals. This cannot be undone. The original file stays in Drive; sync again to update Sheets.`
              : "Correct the extracted details. Your original document and Drive filename stay unchanged."}
          </Dialog.Description>
          {error && (
            <p className="message error" role="alert">
              {error}
            </p>
          )}
          {dialog === "delete" ? (
            <div className="actions">
              <Button disabled={busy} onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                className="primary-action"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy ? "Deleting…" : "Delete expense"}
              </Button>
            </div>
          ) : (
            <form
              key={expense.id + String(dialog)}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const text = (key: string) =>
                  String(form.get(key) ?? "").trim() || null;
                void save({
                  vendor: text("vendor"),
                  invoiceNumber: text("invoiceNumber"),
                  date: text("date"),
                  category: text("category"),
                  currency: text("currency")?.toUpperCase() ?? null,
                  total: text("total"),
                  subtotal: text("subtotal"),
                  tax: text("tax"),
                });
              }}
            >
              <div className="expense-fields">
                <label>
                  Name / vendor
                  <Input
                    name="vendor"
                    defaultValue={expense.fields?.vendor ?? ""}
                    maxLength={200}
                    disabled={busy}
                  />
                </label>
                <label>
                  Category
                  <span className="category-select">
                    <select
                      name="category"
                      defaultValue={expense.fields?.category ?? "Other"}
                      disabled={busy}
                    >
                      {categories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                    <CaretDown size={16} aria-hidden="true" />
                  </span>
                </label>
                <label>
                  Date
                  <Input
                    name="date"
                    type="date"
                    defaultValue={expense.fields?.date ?? ""}
                    disabled={busy}
                  />
                </label>
                <label>
                  Invoice number
                  <Input
                    name="invoiceNumber"
                    defaultValue={expense.fields?.invoiceNumber ?? ""}
                    maxLength={100}
                    disabled={busy}
                  />
                </label>
                <label>
                  Currency
                  <Input
                    name="currency"
                    placeholder="INR"
                    pattern="[A-Za-z]{3}"
                    maxLength={3}
                    defaultValue={expense.fields?.currency ?? ""}
                    disabled={busy}
                  />
                </label>
                {(["total", "subtotal", "tax"] as const).map((field) => (
                  <label key={field}>
                    {field === "total"
                      ? "Total"
                      : field === "subtotal"
                        ? "Subtotal"
                        : "Tax"}
                    <Input
                      name={field}
                      inputMode="decimal"
                      pattern="-?[0-9]{1,12}(\.[0-9]{1,3})?"
                      defaultValue={expense.fields?.[field] ?? ""}
                      disabled={busy}
                    />
                  </label>
                ))}
              </div>
              <div className="actions">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="primary-action"
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      </Dialog.Root>
    </>
  );
}
