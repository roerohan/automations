import { useState } from "react";
import { Button, Input } from "@cloudflare/kumo";
import { pickFolder, type Folder, type PickerSession } from "./drive-picker";

interface Props {
  connected: boolean;
  pickerConfigured: boolean;
  folder: { folderName: string; folderId?: string };
  refresh: () => Promise<unknown>;
  api: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
}
export function InvoiceFolder({
  connected,
  pickerConfigured,
  folder,
  refresh,
  api,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Invoices");
  const [parent, setParent] = useState<Folder | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Folder update failed.");
    } finally {
      setBusy(false);
    }
  }
  async function choose() {
    return pickFolder(await api<PickerSession>("/api/google/picker", "POST"));
  }
  return (
    <section className="panel invoice-folder">
      <p className="section-label">02 / DESTINATION</p>
      <h2>Invoice folder</h2>
      <p className="folder-destination">
        {folder.folderId ? (
          <a
            href={`https://drive.google.com/drive/folders/${folder.folderId}`}
            target="_blank"
            rel="noreferrer"
          >
            {folder.folderName} ↗
          </a>
        ) : (
          "Your first receipt will create an Invoices folder in My Drive."
        )}
      </p>
      <div className="actions">
        <Button
          disabled={busy || !connected || !pickerConfigured}
          onClick={() =>
            void run(async () => {
              const selected = await choose();
              if (!selected) return;
              await api("/api/folder", "PUT", { folderId: selected.id });
              await refresh();
              setNotice("Invoice folder updated.");
            })
          }
        >
          Choose folder
        </Button>
        <Button
          disabled={busy || !connected}
          onClick={() => setCreating(!creating)}
        >
          New folder
        </Button>
      </div>
      <p className="muted">
        My Drive and shared folders supported. You need permission to add files.
        Changing folders only affects new receipts.
      </p>
      {!connected && <p>Connect Google before choosing a folder.</p>}
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="message" role="status">
          {notice}
        </p>
      )}
      {creating && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await api("/api/folder", "POST", {
                name,
                parentId: parent?.id,
                requestId,
              });
              // Retain the reservation if creation fails so Retry doesn't create a second folder.
              setCreating(false);
              setRequestId(crypto.randomUUID());
              await refresh();
              setNotice("Folder created and selected for invoices.");
            });
          }}
        >
          <label htmlFor="new-folder-name">New folder name</label>
          <Input
            id="new-folder-name"
            value={name}
            required
            maxLength={100}
            disabled={busy}
            onChange={(event) => {
              setName(event.target.value);
              setRequestId(crypto.randomUUID());
            }}
          />
          <p>
            Create in: <strong>{parent?.name ?? "My Drive"}</strong>
          </p>
          <div className="actions">
            <Button
              type="button"
              disabled={busy || !pickerConfigured}
              onClick={() =>
                void run(async () => {
                  const selected = await choose();
                  if (selected) {
                    setParent(selected);
                    setRequestId(crypto.randomUUID());
                  }
                })
              }
            >
              Choose parent folder
            </Button>
            {parent && (
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setParent(null);
                  setRequestId(crypto.randomUUID());
                }}
              >
                Use My Drive
              </Button>
            )}
          </div>
          <Button
            type="submit"

            className="primary-action"
            disabled={busy || !connected || !name.trim()}
          >
            {busy ? "Working…" : "Create and use folder"}
          </Button>
        </form>
      )}
      {!pickerConfigured && (
        <details className="picker-setup">
          <summary>Enable the Google folder picker</summary>
          <p>
            In the same project as your OAuth client, enable the{" "}
            <a
              href="https://console.cloud.google.com/apis/library/picker.googleapis.com"
              target="_blank"
              rel="noreferrer"
            >
              Google Picker API
            </a>
            , then create an API key under{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
            >
              Credentials
            </a>
            .
          </p>
          <p>
            Restrict the key to Google Picker API and website referrers{" "}
            <code>{window.location.origin}/*</code> and{" "}
            <code>https://docs.google.com/*</code>. Add{" "}
            <code>GOOGLE_PICKER_API_KEY</code> and the numeric{" "}
            <code>GOOGLE_PROJECT_NUMBER</code> to your ignored Wrangler vars,
            then redeploy. The project number is on the{" "}
            <a
              href="https://console.cloud.google.com/home/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              project dashboard
            </a>
            .
          </p>
          <p>
            This browser key is visible to the signed-in owner. Keep your OAuth
            client secret in Worker secrets. You can still create a folder in My
            Drive while picker setup is pending.
          </p>
        </details>
      )}
    </section>
  );
}
