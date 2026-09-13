import type { InvoiceLedger } from "./ledger";
export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  LEDGER: DurableObjectNamespace<InvoiceLedger>;
  APP_URL: string;
  INVOICE_EMAIL: string;
  ALLOWED_SENDERS: string[];
  OWNER_EMAIL: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  AI_MODEL: string;
}
