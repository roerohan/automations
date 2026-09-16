import { afterEach, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import type { Expense } from "../src/server/domain";

let runtime: Miniflare | undefined;
afterEach(async () => {
  await runtime?.dispose();
  runtime = undefined;
});
async function setup(
  observe?: (request: { url: string; method: string }) => void,
  failRename = false,
  emailVerdict = { isReceipt: true, multipleReceipts: false },
) {
  const bundle = await build({
    stdin: {
      contents: `
      import { InvoiceLedger } from './src/server/ledger.ts';
      import worker from './src/server/index.ts';
      export class TestLedger extends InvoiceLedger {
        constructor(ctx, env) {
          super(ctx, {...env, AI: {
            toMarkdown: async () => ({ format: 'markdown', data: 'Example invoice with enough readable text for the extraction process.' }),
            run: async () => ({ response: {vendor:'Example',invoiceNumber:'INV-1',date:'2026-09-13',currency:'INR',subtotal:'100',tax:'18',total:'118',category:'Software', ...${JSON.stringify(emailVerdict)}} })
          }});
        }
        async runAlarm() { await this.alarm(); }
        async storedKeys() { return [...(await this.ctx.storage.list()).keys()]; }
      }
      export default { async fetch(request, env) {
        const { operation, args = [] } = await request.json();
        if (operation === 'ingest') {
          let rejected;
          const raw = new TextEncoder().encode(args[0]);
          await worker.email({from:'owner@example.com',to:'invoices@example.com',rawSize:raw.length,
            raw:new Response(raw).body,headers:new Headers({'Authentication-Results':'mx.cloudflare.net; dmarc=pass'}),setReject: reason => {rejected=reason;}}, env, {});
          return Response.json({rejected});
        }
        const stub = env.LEDGER.get(env.LEDGER.idFromName('owner'));
        return Response.json(await stub[operation](...args) ?? null);
      }};`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    external: ["cloudflare:workers"],
    write: false,
  });
  let generated = 0;
  runtime = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0]!.text,
    compatibilityDate: "2026-07-01",
    durableObjects: { LEDGER: { className: "TestLedger", useSQLite: true } },
    bindings: {
      INVOICE_EMAIL: "invoices@example.com",
      GOOGLE_CLIENT_ID: "test",
      GOOGLE_CLIENT_SECRET: "test",
      AI_MODEL: "test",
      ALLOWED_SENDERS: ["owner@example.com"],
    },
    outboundService: async (request: { url: string; method: string }) => {
      observe?.(request);
      if (failRename && request.method === "PATCH")
        return new Response(null, { status: 403 });
      const url = new URL(request.url);
      if (url.hostname === "oauth2.googleapis.com")
        return Response.json({ access_token: "test-access" });
      if (url.pathname.endsWith("/generateIds"))
        return Response.json({ ids: [`drive-${++generated}`] });
      if (url.searchParams.has("alt"))
        return new Response(
          "From: owner@example.com\r\nSubject: Example Cab receipt\r\nContent-Type: text/plain\r\n\r\nExample Cab invoice INV-1, date 2026-09-13, subtotal INR 100, tax INR 18, total INR 118.",
        );
      if (url.pathname.includes("/files/") && request.method === "GET")
        return Response.json({
          id: url.pathname.split("/").pop(),
          name: "Team bills",
          mimeType: "application/vnd.google-apps.folder",
          capabilities: { canAddChildren: !url.pathname.endsWith("readonly") },
        });
      return Response.json({});
    },
  });
  return async <T>(operation: string, ...args: unknown[]): Promise<T> => {
    const response = await runtime!.dispatchFetch("https://test.invalid", {
      method: "POST",
      body: JSON.stringify({ operation, args }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<T>;
  };
}
const expense: Expense = {
  id: "a".repeat(64),
  filename: "invoice.pdf",
  sender: "owner@example.com",
  receivedAt: "2026-09-13T00:00:00Z",
  status: "uploading",
  issues: [],
  attempts: 0,
};
describe("Durable Object ledger in workerd", () => {
  it("reserves one Drive ID for duplicate deliveries without storing file bytes", async () => {
    const call = await setup();
    await call("connectGoogle", "test-refresh");
    const first = await call<{ driveId: string }>("prepareUpload", expense);
    const duplicate = await call<{ driveId: string }>("prepareUpload", expense);
    expect(duplicate.driveId).toBe(first.driveId);
    await call("finishUpload", expense.id);
    expect(await call("prepareUpload", expense)).toBeNull();
    const state = await call<{ expenses: Expense[] }>("dashboard");
    expect(state.expenses).toHaveLength(1);
    expect(state.expenses[0]!.status).toBe("queued");
    expect(await call<string[]>("storedKeys")).toEqual(
      expect.arrayContaining(["config", "refreshToken"]),
    );
    expect(
      (await call<string[]>("storedKeys")).some(
        (key) => key.startsWith("pdf:") || key.startsWith("chunks:"),
      ),
    ).toBe(false);
  });
  it("processes the original from Drive and records extracted amounts", async () => {
    const call = await setup();
    await call("connectGoogle", "test-refresh");
    await call("prepareUpload", expense);
    await call("finishUpload", expense.id);
    await call("runAlarm");
    const state = await call<{ expenses: Expense[] }>("dashboard");
    expect(state.expenses[0]).toMatchObject({
      status: "ready",
      attempts: 1,
      driveFilename: "Example_2026-09-13_INR_118_aaaaaaaaaaaa.pdf",
      fields: { total: "118", currency: "INR" },
    });
  });
  it("consumes OAuth state once and rejects mismatched state", async () => {
    const call = await setup();
    await call("saveOAuth", "state", "verifier");
    expect(await call("consumeOAuth", "wrong")).toBeNull();
    expect(await call("consumeOAuth", "state")).toMatchObject({
      verifier: "verifier",
    });
    expect(await call("consumeOAuth", "state")).toBeNull();
  });
});

it("selects a shared folder without renaming or recreating it, and uses it for uploads", async () => {
  const writes: string[] = [];
  const call = await setup((request) => {
    if (request.method !== "GET" && request.url.includes("/drive/"))
      writes.push(request.url);
  });
  await call("connectGoogle", "test-refresh");
  await call("selectFolder", "shared-folder");
  const reservation = await call<{ folderId: string }>(
    "prepareUpload",
    expense,
  );
  expect(reservation.folderId).toBe("shared-folder");
  expect(writes).toEqual([]);
});
it("keeps the current destination when a selected folder is read-only", async () => {
  const call = await setup();
  await call("connectGoogle", "test-refresh");
  await call("selectFolder", "shared-folder");
  expect(await call("selectFolder", "readonly")).toHaveProperty("error");
  expect(await call("config")).toMatchObject({ folderId: "shared-folder" });
});
it("reuses a created folder ID when the same request is retried", async () => {
  const call = await setup();
  await call("connectGoogle", "test-refresh");
  const input = {
    name: "Invoices",
    parentId: "shared-folder",
    requestId: crypto.randomUUID(),
  };
  const first = await call("createFolder", input);
  expect(await call("createFolder", input)).toEqual(first);
  expect(
    await call("createFolder", { ...input, name: "Different" }),
  ).toHaveProperty("error");
});

it("keeps extracted data and the original name when Drive renaming fails", async () => {
  const call = await setup(undefined, true);
  await call("connectGoogle", "test-refresh");
  await call("prepareUpload", expense);
  await call("finishUpload", expense.id);
  await call("runAlarm");
  const state = await call<{ expenses: Expense[] }>("dashboard");
  expect(state.expenses[0]).toMatchObject({
    status: "ready",
    filename: "invoice.pdf",
    fields: { total: "118" },
  });
  expect(state.expenses[0]!.driveFilename).toBeUndefined();
  expect(state.expenses[0]!.issues).toContain(
    "Drive filename update failed. Use Rename file to retry.",
  );
});

it("ingests a forwarded body, uploads the email, and extracts it from Drive", async () => {
  const call = await setup();
  await call("connectGoogle", "test-refresh");
  const raw =
    "From: owner@example.com\r\nSubject: Fwd: Example Cab receipt\r\nContent-Type: text/html\r\n\r\n<h1>Example Cab</h1><p>Receipt INV-1 on 2026-09-13, Total INR 118.00</p><a href='https://cab.example/receipt?token=test'>Download receipt</a>";
  expect(await call("ingest", raw)).toEqual({});
  const ingested = await call<{ expenses: Expense[] }>("dashboard");
  expect(ingested.expenses[0]!.receiptLinks).toEqual([
    {
      url: "https://cab.example/receipt?token=test",
      label: "Download receipt",
    },
  ]);
  expect(await call("ingest", raw)).toEqual({});
  await call("runAlarm");
  const state = await call<{ expenses: Expense[] }>("dashboard");
  expect(state.expenses).toHaveLength(1);
  expect(state.expenses[0]).toMatchObject({
    source: "email",
    status: "ready",
    fields: { total: "118" },
  });
  expect(state.expenses[0]!.driveFilename).toMatch(/\.eml$/);
  expect(await call<string[]>("storedKeys")).not.toContain("body");
});
it("prefers PDF attachments over the body to avoid two expenses", async () => {
  const call = await setup();
  await call("connectGoogle", "test-refresh");
  const raw = [
    "From: owner@example.com",
    "Subject: Receipt",
    "Content-Type: multipart/mixed; boundary=boundary",
    "",
    "--boundary",
    "Content-Type: text/plain",
    "",
    "Example Cab invoice INV-1, 2026-09-13, Total INR 118.00",
    "--boundary",
    "Content-Type: application/pdf",
    "Content-Disposition: attachment; filename=invoice.pdf",
    "Content-Transfer-Encoding: base64",
    "",
    btoa("%PDF-test"),
    "--boundary--",
  ].join("\r\n");
  expect(await call("ingest", raw)).toEqual({});
  const state = await call<{ expenses: Expense[] }>("dashboard");
  expect(state.expenses).toHaveLength(1);
  expect(state.expenses[0]!.source).toBe("pdf");
});
it.each([
  { isReceipt: false, multipleReceipts: false },
  { isReceipt: true, multipleReceipts: true },
])(
  "holds non-receipts or multiple purchases for review: %j",
  async (verdict) => {
    const call = await setup(undefined, false, verdict);
    await call("connectGoogle", "test-refresh");
    await call("prepareUpload", {
      ...expense,
      source: "email",
      filename: "receipt.eml",
    });
    await call("finishUpload", expense.id);
    await call("runAlarm");
    const state = await call<{ expenses: Expense[] }>("dashboard");
    expect(state.expenses[0]!.status).toBe("review");
    expect(state.expenses[0]!.fields).toBeUndefined();
  },
);
