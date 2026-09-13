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

it("checks shared folder write capability without requesting broad Drive access", async () => {
  const mock = vi.fn().mockResolvedValue(
    Response.json({
      id: "shared",
      name: "Team bills",
      mimeType: "application/vnd.google-apps.folder",
      capabilities: { canAddChildren: true },
    }),
  );
  vi.stubGlobal("fetch", mock);
  const { writableFolder } = await import("../src/server/google");
  expect(await writableFolder("token", "shared")).toEqual({
    id: "shared",
    name: "Team bills",
  });
  expect(
    new URL(mock.mock.calls[0]![0]).searchParams.get("supportsAllDrives"),
  ).toBe("true");
});
it.each([
  { mimeType: "application/pdf", capabilities: { canAddChildren: true } },
  {
    mimeType: "application/vnd.google-apps.folder",
    trashed: true,
    capabilities: { canAddChildren: true },
  },
  {
    mimeType: "application/vnd.google-apps.folder",
    capabilities: { canAddChildren: false },
  },
])("rejects non-writable folder selections: %j", async (metadata) => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ id: "folder", name: "Folder", ...metadata }),
      ),
  );
  const { writableFolder } = await import("../src/server/google");
  await expect(writableFolder("token", "folder")).rejects.toThrow();
});
