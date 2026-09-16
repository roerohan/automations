import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Input, Badge } from "@cloudflare/kumo";
import "@cloudflare/kumo/styles/standalone";
import "./style.css";
import { InvoiceFolder } from "./invoice-folder";
import { GoogleSetupGuide } from "./google-setup-guide";
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
      error: "Request failed. Refresh your Access session and try again.",
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
  const [tab, setTab] = useState<"expenses" | "settings">("expenses");
  const [search, setSearch] = useState("");
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
        <a className="brand" href="/">
          ▤ <span>Automations</span>
        </a>
        <div className="workspace">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button
            aria-current={tab === "expenses" ? "page" : undefined}
            onClick={() => setTab("expenses")}
          >
            Invoices
          </button>
          <button
            aria-current={tab === "settings" ? "page" : undefined}
            onClick={() => setTab("settings")}
          >
            Settings & connections
          </button>
        </nav>
        <p className="aside-footer">
          Invoice categorizer
          <br />
          <small>Private workspace · Cloudflare Access</small>
        </p>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">INVOICE CATEGORIZER</p>
            <h1>
              {tab === "expenses"
                ? "Your expenses, organized."
                : "Settings & connections"}
            </h1>
            <p className="muted">
              {tab === "expenses"
                ? "Email a PDF. Keep the original. Know where your money goes."
                : "Manage your storage connection and invoice destination."}
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
              <div className="panel">
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
                <small>Ready expenses · all time · grouped by currency</small>
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
                <small>Review details before including in totals</small>
              </div>
            </section>
            {!data.connected && (
              <section className="setup">
                <div>
                  <h2>Connect Google to start collecting invoices</h2>
                  <p>
                    Original PDFs go to your Drive. Your expense ledger stays
                    here.
                  </p>
                </div>
                <Button variant="primary" onClick={() => setTab("settings")}>
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
                    variant="primary"
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
              <Input
                aria-label="Search expenses"
                placeholder="Search vendor, category, filename or expense ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Expense</th>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Original</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
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
                          <Badge>{item.status}</Badge>
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
                          {item.driveId ? (
                            <a
                              href={`https://drive.google.com/file/d/${item.driveId}/view`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View PDF ↗
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
                  <span>▤</span>
                  <h3>
                    {search
                      ? "No matching expenses"
                      : "Your first invoice starts here"}
                  </h3>
                  <p>
                    {search
                      ? "Try another vendor or filename."
                      : "Once Google is connected, forward a PDF invoice from an allowed email address. It will appear here after processing."}
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
            <section className="panel">
              <h2>Google Drive & Sheets</h2>
              <p>
                Connect your Google account to store originals and export your
                ledger on demand. Access is limited to files created or selected
                through this app.
              </p>
              {!data.oauthConfigured && (
                <p className="message">
                  Google OAuth credentials have not been configured. Follow the
                  setup guide below to add your client ID and secret.
                </p>
              )}
              <div className="actions">
                <Button
                  variant="primary"
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
                Disconnecting removes the stored credential. You can also revoke
                access in your Google account.
              </small>
            </section>
            <section className="panel google-setup-panel">
              <GoogleSetupGuide configured={data.oauthConfigured} />
            </section>
            <InvoiceFolder
              connected={data.connected}
              pickerConfigured={data.pickerConfigured}
              folder={data.config}
              refresh={refresh}
              api={api}
            />
            <section className="panel">
              <h2>Email intake</h2>
              <dl>
                <dt>Receiving address</dt>
                <dd>{data.invoiceEmail}</dd>
                <dt>Allowed senders</dt>
                <dd>{data.allowedSenders.join(", ")}</dd>
              </dl>
              <p className="muted">
                These addresses are managed in Wrangler configuration. V1
                accepts PDFs with selectable text, up to 8 MiB each. Photos and
                scanned documents are planned.
              </p>
            </section>
            <section className="panel">
              <h2>Manual spreadsheet export</h2>
              <p>
                Sync creates or updates an app-owned spreadsheet snapshot. The
                Durable Object remains the source of truth. Keep personal
                formulas in a separate sheet.
              </p>
            </section>
          </div>
        )}
        <footer>
          Originals in your Drive. Records in your Cloudflare account.
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
