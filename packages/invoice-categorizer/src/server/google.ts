import type { Env } from "./env";

export const GOOGLE_SCOPES = "https://www.googleapis.com/auth/drive.file";
export async function tokenRequest(env: Env, values: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      ...values,
    }),
  });
  if (!response.ok)
    throw new Error(
      "Google authorization failed. Reconnect Google in Settings.",
    );
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
  };
}
export async function googleFetch(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(
      `Google API request failed (${response.status}). Check connection and retry.`,
    );
  return response;
}
export async function generateDriveId(token: string): Promise<string> {
  const result = (await (
    await googleFetch(
      token,
      "https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive",
    )
  ).json()) as { ids: string[] };
  return result.ids[0]!;
}
export async function createDriveFile(
  token: string,
  id: string,
  name: string,
  mimeType: string,
  parent?: string,
  bytes?: ArrayBuffer,
): Promise<void> {
  // Preallocated IDs make a successful write safe to retry after a lost response.
  const metadata = {
    id,
    name,
    mimeType,
    ...(parent ? { parents: [parent] } : {}),
  };
  let response: Response;
  if (bytes) {
    const boundary = `invoice_${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
      bytes,
      `\r\n--${boundary}--`,
    ]);
    response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
        signal: AbortSignal.timeout(60_000),
      },
    );
  } else {
    response = await fetch(
      "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(60_000),
      },
    );
  }
  if (!response.ok && response.status !== 409)
    throw new Error(`Drive upload failed (${response.status}).`);
}

export class FolderError extends Error {}
export interface DriveFolder {
  id: string;
  name: string;
}
export async function writableFolder(
  token: string,
  id: string,
): Promise<DriveFolder> {
  if (!/^[\w-]+$/.test(id)) throw new FolderError("Invalid Drive folder ID.");
  let response: Response;
  try {
    response = await googleFetch(
      token,
      `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id,name,mimeType,trashed,capabilities(canAddChildren)`,
    );
  } catch {
    throw new FolderError(
      "Cannot access this folder. Select it again in Google Drive and check your sharing permissions.",
    );
  }
  const folder = (await response.json()) as {
    id: string;
    name: string;
    mimeType: string;
    trashed?: boolean;
    capabilities?: { canAddChildren?: boolean };
  };
  if (
    folder.trashed ||
    folder.mimeType !== "application/vnd.google-apps.folder"
  )
    throw new FolderError("Select a folder that is not in the trash.");
  if (!folder.capabilities?.canAddChildren)
    throw new FolderError(
      "You need permission to add files to this folder. Choose another folder or ask its owner for access.",
    );
  return { id: folder.id, name: folder.name };
}
