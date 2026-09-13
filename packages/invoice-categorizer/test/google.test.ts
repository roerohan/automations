import { afterEach, expect, it, vi } from "vitest";
import { createDriveFile, googleFetch } from "../src/server/google";
afterEach(() => vi.unstubAllGlobals());
it("uses a stable Drive ID and accepts an existing upload on retry", async () => {
  const mock = vi.fn().mockResolvedValue(new Response(null, { status: 409 }));
  vi.stubGlobal("fetch", mock);
  await createDriveFile(
    "secret",
    "stable-id",
    "invoice.pdf",
    "application/pdf",
    "folder",
    new TextEncoder().encode("%PDF-test").buffer,
  );
  const [, options] = mock.mock.calls[0]!;
  expect(await (options.body as Blob).text()).toContain('"id":"stable-id"');
});
it("fails on upload errors without exposing response content", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("sensitive document content", { status: 403 }),
      ),
  );
  await expect(
    createDriveFile("secret", "id", "invoice.pdf", "application/pdf"),
  ).rejects.toThrow("Drive upload failed (403)");
});
it("adds authentication server-side and suppresses upstream errors", async () => {
  const mock = vi
    .fn()
    .mockResolvedValue(new Response("private response", { status: 401 }));
  vi.stubGlobal("fetch", mock);
  await expect(
    googleFetch("secret", "https://www.googleapis.com/drive/v3/files"),
  ).rejects.toThrow("Google API request failed (401)");
  expect((mock.mock.calls[0]![1].headers as Headers).get("Authorization")).toBe(
    "Bearer secret",
  );
});
