import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Receipt,
  SlidersHorizontal,
  Sparkle,
  ArrowDownLeft,
  ArrowUp,
  ArrowDown,
  ArrowsDownUp,
} from "@phosphor-icons/react";
import { Button, Input, Badge } from "@cloudflare/kumo";
import "@cloudflare/kumo/styles/standalone";
import "./style.css";
import { ThemeSwitcher } from "./theme-switcher";
import { InvoiceFolder } from "./invoice-folder";
import { GoogleSetupGuide } from "./google-setup-guide";
import { expenseColumns, sortExpenses, type ExpenseSort } from "./expense-sort";
import type { Expense } from "../server/domain";

interface Dashboard {
  expenses: Expense[];
  connected: boolean;
  oauthConfigured: boolean;
  pickerConfigured: boolean;
  invoiceEmail: string;
  allowedSenders: string[];
  config: {
    folderName: string;
    folderId?: string;
    spreadsheetId?: string;
    lastSync?: string;
  };
}
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({
      error: "Request failed. Refresh your session and try again.",
    }))) as { error: string };
    throw new Error(error.error);
  }
  return response.json() as Promise<T>;
}
function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
function App() {
  const [data, setData] = useState<Dashboard>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"expenses" | "settings">(() =>
    window.location.pathname.replace(/\/$/, "") === "/settings"
      ? "settings"
      : "expenses",
  );
  function navigate(page: "expenses" | "settings") {
    const path = page === "expenses" ? "/invoices" : "/settings";
    if (window.location.pathname !== path)
      window.history.pushState(null, "", path);
    setTab(page);
    window.scrollTo(0, 0);
  }
  function followPage(
    event: React.MouseEvent<HTMLAnchorElement>,
    page: "expenses" | "settings",
  ) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(page);
  }
  useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState(
        null,
        "",
        `/invoices${window.location.search}${window.location.hash}`,
      );
    }
    const onPopState = () =>
      setTab(
        window.location.pathname.replace(/\/$/, "") === "/settings"
          ? "settings"
          : "expenses",
      );
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ExpenseSort>({
    key: "date",
    direction: "descending",
  });
  async function refresh() {
    const next = await api<Dashboard>("/api/dashboard");
    setData(next);
    return next;
  }
  useEffect(() => {
    void refresh().catch((e: Error) => setError(e.message));
  }, []);
  async function action(run: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await run();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  const ready =
    data?.expenses.filter((expense) => expense.status === "ready") ?? [];
  const totals = new Map<string, number>();
  for (const expense of ready) {
    const currency = expense.fields?.currency;
    if (currency && expense.fields?.total !== null)
      totals.set(
        currency,
        (totals.get(currency) ?? 0) + Number(expense.fields?.total),
      );
  }
  const filtered =
    data?.expenses.filter((item) =>
      [
        item.id,
        item.filename,
        item.driveFilename,
        item.fields?.vendor,
        item.fields?.category,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  return (
    <div className="shell">
      <aside>
        <a
          className="brand"
          href="/invoices"
          onClick={(event) => followPage(event, "expenses")}
        >
          <span className="brand-mark">
            <Receipt size={22} aria-hidden="true" />
          </span>
          <span>Automations</span>
        </a>
        <div className="workspace">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          <a
            href="/invoices"
            aria-current={tab === "expenses" ? "page" : undefined}
            onClick={(event) => followPage(event, "expenses")}
          >
            <Receipt size={18} aria-hidden="true" /> Invoices
          </a>
          <a
            href="/settings"
            aria-current={tab === "settings" ? "page" : undefined}
            onClick={(event) => followPage(event, "settings")}
          >
            <SlidersHorizontal size={18} aria-hidden="true" /> Settings
          </a>
        </nav>
        <ThemeSwitcher />
        <p className="aside-footer">
          <Sparkle size={16} aria-hidden="true" />
          <span>
            Less admin. More clarity.
            <br />
            <small>AI-powered invoice sorting</small>
          </span>
        </p>
      </aside>
      <main key={tab}>
        <header>
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>
              {tab === "expenses"
                ? "Your expenses, organized."
                : "Make it yours."}
            </h1>
            <p className="muted">
              {tab === "expenses"
                ? "Forward a receipt. Keep the original. Know where your money goes."
                : "Choose where receipts land and how you keep your records."}
            </p>
          </div>
          <Badge>{data?.connected ? "Google connected" : "Setup needed"}</Badge>
        </header>
        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="message" role="status">
            {notice}
          </div>
        )}
        {!data ? (
          <section className="panel">
            <p>
              {error
                ? "Unable to load the workspace."
                : "Loading your workspace…"}
            </p>
            <Button
              onClick={() => void action(refresh, "Workspace refreshed.")}
              disabled={busy}
            >
              Try again
            </Button>
          </section>
        ) : tab === "expenses" ? (
          <>
            <section className="metrics" aria-label="Expense summary">
              <div className="panel spend-panel">
                <p className="label">Recorded spend</p>
                {totals.size ? (
                  [...totals].map(([currency, total]) => (
                    <strong className="metric" key={currency}>
                      {money(total, currency)}
                    </strong>
                  ))
                ) : (
                  <strong className="metric">—</strong>
                )}
                <small>All time · ready expenses only</small>
              </div>
              <div className="panel">
                <p className="label">Invoices received</p>
                <strong className="metric">{data.expenses.length}</strong>
                <small>{ready.length} ready for your records</small>
              </div>
              <div className="panel">
                <p className="label">Needs attention</p>
                <strong className="metric">
                  {
                    data.expenses.filter((item) =>
                      ["review", "failed"].includes(item.status),
                    ).length
                  }
                </strong>
                <small>Flagged for your review</small>
              </div>
            </section>
            {!data.connected && (
              <section className="setup">
                <div>
                  <h2>Connect Google to start collecting invoices</h2>
                  <p>
                    Original PDFs and emails go to your Drive. Your expense
                    ledger stays here.
                  </p>
                </div>
                <Button
                  className="primary-action"
                  onClick={() => navigate("settings")}
                >
                  Set up Google
                </Button>
              </section>
            )}
            <section className="panel expenses">
              <div className="toolbar">
                <div>
                  <h2>All expenses</h2>
                  <p className="muted">
                    Send invoices to{" "}
                    <a href={`mailto:${data.invoiceEmail}`}>
                      {data.invoiceEmail}
                    </a>
                  </p>
                </div>
                <div className="actions">
                  <Button
                    disabled={busy}
                    onClick={() => void action(refresh, "Workspace refreshed.")}
                  >
                    Refresh
                  </Button>
                  <Button
                    className="primary-action"
                    disabled={busy || !data.connected}
                    onClick={() =>
                      void action(
                        () => api("/api/sync", "POST"),
                        "Google Sheets snapshot updated.",
                      )
                    }
                  >
                    {busy ? "Working…" : "Sync to Sheets"}
                  </Button>
                </div>
              </div>
              <div className="expense-search">
                <Input
                  aria-label="Search expenses"
                  placeholder="Search vendor, category, filename or expense ID"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div
                className="table-scroll"
                role="region"
                aria-label="Expenses table"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      {expenseColumns.map(({ key, label }) => {
                        const active = sort.key === key;
                        const nextDirection =
                          active && sort.direction === "ascending"
                            ? "descending"
                            : "ascending";
                        const Icon = !active
                          ? ArrowsDownUp
                          : sort.direction === "ascending"
                            ? ArrowUp
                            : ArrowDown;
                        return (
                          <th
                            key={key}
                            scope="col"
                            className={key === "amount" ? "amount" : undefined}
                            aria-sort={active ? sort.direction : undefined}
                          >
                            <button
                              type="button"
                              className="sort-heading"
                              onClick={() =>
                                setSort({ key, direction: nextDirection })
                              }
                              aria-label={`Sort ${label.toLowerCase()} ${nextDirection}${key === "amount" ? " within each currency" : ""}`}
                              title={
                                key === "amount"
                                  ? "Sort amount within each currency"
                                  : `Sort by ${label.toLowerCase()}`
                              }
                            >
                              {label}
                              <Icon size={14} aria-hidden="true" />
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortExpenses(filtered, sort).map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.fields?.vendor ?? item.filename}
                          </strong>
                          <small title={item.id}>
                            ID {item.id.slice(0, 12)}
                          </small>
                          {item.driveFilename && (
                            <small>{item.driveFilename}</small>
                          )}
                          {item.issues.map((issue) => (
                            <small className="issue" key={issue}>
                              {issue}
                            </small>
                          ))}
                        </td>
                        <td>
                          {item.fields?.date ?? item.receivedAt.slice(0, 10)}
                        </td>
                        <td>{item.fields?.category ?? "—"}</td>
                        <td className="amount">
                          {item.fields?.total != null && item.fields.currency
                            ? money(
                                Number(item.fields.total),
                                item.fields.currency,
                              )
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`expense-status status-${item.status}`}
                          >
                            <Badge>{item.status}</Badge>
                          </span>
                          {item.fields &&
                            item.driveId &&
                            !item.driveFilename &&
                            ["ready", "review"].includes(item.status) && (
                              <Button
                                size="sm"
                                disabled={busy || !data.connected}
                                onClick={() =>
                                  void action(
                                    () =>
                                      api("/api/rename", "POST", {
                                        id: item.id,
                                      }),
                                    "Drive filename updated.",
                                  )
                                }
                              >
                                Rename file
                              </Button>
                            )}

                          {["failed", "review"].includes(item.status) && (
                            <Button
                              size="sm"
                              disabled={busy || !data.connected}
                              onClick={() =>
                                void action(
                                  () =>
                                    api("/api/retry", "POST", { id: item.id }),
                                  "Invoice queued for another attempt.",
                                )
                              }
                            >
                              Retry
                            </Button>
                          )}
                        </td>
                        <td>
                          {item.receiptLinks?.map((link, index) => (
                            <div key={link.url}>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                title={`${link.label} · ${new URL(link.url).hostname} · Sign-in may be required`}
                              >
                                Download receipt
                                {item.receiptLinks!.length > 1
                                  ? ` ${index + 1}`
                                  : ""}{" "}
                                ↗
                              </a>
                              <small>
                                {new URL(link.url).hostname} · May require
                                sign-in
                              </small>
                            </div>
                          ))}
                          {item.driveId ? (
                            <a
                              href={`https://drive.google.com/file/d/${item.driveId}/view`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {item.source === "email"
                                ? "View email ↗"
                                : "View PDF ↗"}
                            </a>
                          ) : (
                            "Pending"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && (
                <div className="empty">
                  <span>
                    <ArrowDownLeft size={32} aria-hidden="true" />
                  </span>
                  <h3>
                    {search
                      ? "No matching expenses"
                      : "Your first invoice starts here"}
                  </h3>
                  <p>
                    {search
                      ? "Try another vendor or filename."
                      : "Once Google is connected, forward a receipt email or PDF from an allowed email address. It will appear here after processing."}
                  </p>
                </div>
              )}
              {data.config.lastSync && (
                <p className="sync-note">
                  Last synced {new Date(data.config.lastSync).toLocaleString()}{" "}
                  ·{" "}
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${data.config.spreadsheetId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open spreadsheet ↗
                  </a>
                </p>
              )}
            </section>
          </>
        ) : (
          <div className="settings">
            <section className="panel connection-panel">
              <p className="section-label">01 / CONNECTION</p>
              <h2>Google Drive & Sheets</h2>
              <p>
                Save original receipts to Drive and send your expenses to Sheets
                when you need them.
              </p>
              {!data.oauthConfigured && (
                <p className="message">
                  Google OAuth credentials have not been configured. Follow the
                  setup guide below to add your client ID and secret.
                </p>
              )}
              <div className="actions">
                <Button
                  className="primary-action"
                  disabled={busy || !data.oauthConfigured}
                  onClick={() =>
                    void action(async () => {
                      const result = await api<{ url: string }>(
                        "/api/google/connect",
                        "POST",
                      );
                      window.location.assign(result.url);
                    }, "")
                  }
                >
                  {data.connected ? "Reconnect Google" : "Connect Google"}
                </Button>
                {data.connected && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void action(
                        () => api("/api/google/disconnect", "POST"),
                        "Google disconnected. Existing files remain in Drive.",
                      )
                    }
                  >
                    Disconnect
                  </Button>
                )}
              </div>
              <small>
                Only files you create or select here are accessible.
                Disconnecting keeps your existing files.
              </small>
            </section>
            <InvoiceFolder
              connected={data.connected}
              pickerConfigured={data.pickerConfigured}
              folder={data.config}
              refresh={refresh}
              api={api}
            />
            <section className="panel intake-panel">
              <p className="section-label">03 / SEND RECEIPTS</p>
              <h2>Your invoice inbox</h2>
              <dl>
                <dt>Receiving address</dt>
                <dd>
                  <a href={`mailto:${data.invoiceEmail}`}>
                    {data.invoiceEmail} ↗
                  </a>
                </dd>
                <dt>Allowed senders</dt>
                <dd>{data.allowedSenders.join(", ")}</dd>
              </dl>
              <p className="muted">
                Forward a receipt email or attach a text-based PDF up to 8 MiB.
                We extract the details and sort the expense for you.
              </p>
            </section>
            <section className="panel export-panel">
              <div>
                <p className="section-label">04 / EXPORT</p>
                <h2>Your records, ready to share</h2>
                <p>
                  Use Sync to Sheets on the Invoices page to update your
                  spreadsheet. Sync replaces the exported data; keep your own
                  formulas in a separate tab.
                </p>
              </div>
              <Button onClick={() => navigate("expenses")}>
                Go to invoices ↗
              </Button>
            </section>
            <section className="panel google-setup-panel">
              <GoogleSetupGuide configured={data.oauthConfigured} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
