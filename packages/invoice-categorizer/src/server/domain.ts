import { z } from "zod";

export const categories = [
  "Software",
  "Travel",
  "Meals",
  "Office",
  "Services",
  "Other",
] as const;
const money = z
  .string()
  .regex(/^-?\d{1,12}(\.\d{1,3})?$/)
  .nullable();
export const extractedSchema = z.object({
  vendor: z.string().max(200).nullable(),
  invoiceNumber: z.string().max(100).nullable(),
  date: z.iso.date().nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  subtotal: money,
  tax: money,
  total: money,
  category: z.enum(categories),
});
export type Extracted = z.infer<typeof extractedSchema>;
export interface Expense {
  id: string;
  filename: string;
  receivedAt: string;
  sender: string;
  driveId?: string;
  status: "uploading" | "queued" | "processing" | "ready" | "review" | "failed";
  fields?: Extracted;
  issues: string[];
  attempts: number;
}
const driveFolderId = z.string().regex(/^[\w-]{1,200}$/);
export const folderSelectionSchema = z.object({ folderId: driveFolderId });
export const folderCreationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  parentId: driveFolderId.optional(),
  requestId: z.uuid(),
});
export function reviewIssues(fields: Extracted): string[] {
  const issues: string[] = [];
  if (
    !fields.vendor ||
    !fields.date ||
    !fields.currency ||
    fields.total === null
  )
    issues.push("Missing required invoice details");
  if (
    fields.total !== null &&
    fields.subtotal !== null &&
    fields.tax !== null
  ) {
    // Compare in thousandths to cover currencies with three decimal places.
    const units = (value: string) => Math.round(Number(value) * 1000);
    if (
      Math.abs(
        units(fields.subtotal) + units(fields.tax) - units(fields.total),
      ) > 10
    )
      issues.push("Subtotal plus tax does not match total");
  }
  return issues;
}
export async function digest(bytes: BufferSource): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function allowedEnvelope(
  to: string,
  from: string,
  recipient: string,
  senders: string[],
): boolean {
  return (
    to.toLowerCase() === recipient.toLowerCase() &&
    senders.some((sender) => sender.toLowerCase() === from.toLowerCase())
  );
}
export const MAX_PDF_BYTES = 8 * 1024 * 1024;
export function isPdf(bytes: Uint8Array): boolean {
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

/** Trust only Cloudflare's first ingress result, not a later sender-supplied pass. */
export function authenticatedEmail(result: string): boolean {
  if (!/^mx\.cloudflare\.net\s*;/i.test(result.trim())) return false;
  return /;\s*dmarc=(\w+)/i.exec(result)?.[1]?.toLowerCase() === "pass";
}
