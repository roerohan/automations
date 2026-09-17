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
  const [dialog, setDialog] = useState<
    "edit" | "delete" | "attach" | "remove-email" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mutable = ["ready", "review", "failed"].includes(expense.status);
  const name = expense.fields?.vendor ?? expense.filename;
  function open(kind: "edit" | "delete" | "attach" | "remove-email") {
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
  async function tryDownload() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/expenses/${expense.id}/fetch-receipt`, "POST");
      setDialog(null);
      onNotice("Receipt PDF saved to Drive.");
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Open the link and attach the downloaded PDF.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function receiptAction(file?: File) {
    setBusy(true);
    setError("");
    try {
      if (file) {
        if (!file.size || file.size > 8 * 1024 * 1024)
          throw new Error("Choose a PDF up to 8 MiB.");
        const response = await fetch(`/api/expenses/${expense.id}/receipt`, {
          method: "POST",
          headers: { "Content-Type": "application/pdf" },
          body: file,
        });
        if (!response.ok)
          throw new Error(
            "Could not attach the PDF. Check your Google connection and try again.",
          );
      } else await api(`/api/expenses/${expense.id}/saved-email`, "POST");
      setDialog(null);
      onNotice(
        file
          ? "Receipt PDF saved to Drive. Expense details are unchanged."
          : "Saved email moved to Drive trash. Expense details and receipt links are kept.",
      );
      try {
        await refresh();
      } catch {
        onNotice("Saved. Reload the page to refresh the table.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Receipt update failed.");
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
          {expense.source === "email" && (
            <>
              <DropdownMenu.Item
                disabled={!mutable}
                onClick={() => open("attach")}
              >
                Attach receipt PDF
              </DropdownMenu.Item>
              {expense.driveId && (
                <DropdownMenu.Item
                  disabled={!mutable}
                  onClick={() => open("remove-email")}
                >
                  Remove saved email from Drive
                </DropdownMenu.Item>
              )}
            </>
          )}
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
            {dialog === "attach"
              ? "Attach receipt PDF"
              : dialog === "remove-email"
                ? "Remove saved email?"
                : dialog === "delete"
                  ? "Delete expense?"
                  : "Edit expense details"}
          </Dialog.Title>
          <Dialog.Description>
            {dialog === "attach"
              ? "Open the download link, sign in on the provider's website if needed, then choose the downloaded PDF. It will be saved to your invoice folder and linked to this expense; existing expense details stay unchanged."
              : dialog === "remove-email"
                ? "Move this app's saved email to Drive trash. The expense and download links will remain. You can restore the email from Drive trash."
                : dialog === "delete"
                  ? `Remove ${name} from your expenses and totals. This cannot be undone. The original file stays in Drive; sync again to update Sheets.`
                  : "Correct the extracted details. Your original document and Drive filename stay unchanged."}
          </Dialog.Description>
          {error && (
            <p className="message error" role="alert">
              {error}
            </p>
          )}
          {dialog === "attach" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const file = new FormData(event.currentTarget).get("receipt");
                if (file instanceof File) void receiptAction(file);
              }}
            >
              {expense.receiptLinks?.map((link) => (
                <p key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    Download receipt ↗
                  </a>
                </p>
              ))}
              {!!expense.receiptLinks?.length && (
                <p>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void tryDownload()}
                  >
                    Try automatic download
                  </Button>
                </p>
              )}
              <label>
                Receipt PDF (up to 8 MiB)
                <Input
                  name="receipt"
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  disabled={busy}
                />
              </label>
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
                  {busy ? "Uploading…" : "Save PDF to Drive"}
                </Button>
              </div>
            </form>
          ) : dialog === "remove-email" ? (
            <div className="actions">
              <Button disabled={busy} onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                disabled={busy}
                className="primary-action"
                onClick={() => void receiptAction()}
              >
                {busy ? "Removing…" : "Move email to trash"}
              </Button>
            </div>
          ) : dialog === "delete" ? (
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
