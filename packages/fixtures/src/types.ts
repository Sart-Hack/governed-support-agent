export type Tenant = "tenant-A" | "tenant-B";

export type TicketStatus = "new" | "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface ZendeskTicket {
  id: string;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: TicketPriority;
  requester: { email: string; name: string };
  accountId: string;
  tenant: Tenant;
  createdAt: string;
  scenario?: number;
  tags?: string[];
}

export type NotionTag = "public" | "support-kb" | "internal" | "eng-only";

export interface NotionPage {
  id: string;
  title: string;
  tag: NotionTag;
  body: string;
  tenant: Tenant;
  lastEditedAt: string;
}

export type AccountTier = "free" | "starter" | "team" | "enterprise";

export interface HubspotAccount {
  id: string;
  name: string;
  primaryContact: { name: string; email: string };
  tier: AccountTier;
  notes: string;
  tenant: Tenant;
  customFields?: Record<string, string>;
}
