import { isPdf, MAX_PDF_BYTES } from "./domain";
import type { ReceiptLink } from "./receipt-links";

// Only contact explicitly trusted vendor hosts; never follow arbitrary email URLs.
const hosts = new Set([
  "uber.com",
  "www.uber.com",
  "riders.uber.com",
  "trip.uber.com",
  "tracking.ibt.uber.com",
]);
export function allowedReceiptUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      hosts.has(url.hostname)
    );
  } catch {
    return false;
  }
}
export async function boundedPdf(response: Response): Promise<ArrayBuffer> {
  if (
    !response.body ||
    Number(response.headers.get("content-length")) > MAX_PDF_BYTES
  )
    throw new Error("PDF exceeds 8 MiB.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_PDF_BYTES) throw new Error("PDF exceeds 8 MiB.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  if (!isPdf(bytes)) throw new Error("Choose a valid PDF receipt.");
  return bytes.buffer;
}
/** No cookies, credentials, scripts, or login automation. Failure leaves a link. */
export async function downloadReceipt(
  links: ReceiptLink[],
): Promise<ArrayBuffer | undefined> {
  const candidate = links.find((link) => allowedReceiptUrl(link.url));
  if (!candidate) return;
  let url = candidate.url;
  const signal = AbortSignal.timeout(15_000);
  try {
    for (let hop = 0; hop < 5; hop++) {
      if (!allowedReceiptUrl(url)) return;
      const response = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { Accept: "application/pdf" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) return;
        url = new URL(location, url).href;
        continue;
      }
      if (
        !response.ok ||
        !response.headers
          .get("content-type")
          ?.toLowerCase()
          .startsWith("application/pdf")
      ) {
        await response.body?.cancel();
        return;
      }
      return await boundedPdf(response);
    }
  } catch {
    /* Login, expired links, and download failures retain the original link. */
  }
}
