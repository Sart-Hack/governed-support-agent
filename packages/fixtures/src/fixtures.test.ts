import { describe, expect, it } from "vitest";
import {
  HUBSPOT_ACCOUNTS,
  INJECTION_PAYLOAD_PAGE_ID,
  NOTION_PAGES,
  PII_ACCOUNT_IDS,
  TICKETS,
} from "./index.js";

describe("@gsa/fixtures cardinality", () => {
  it("ships exactly 12 zendesk tickets", () => {
    expect(TICKETS).toHaveLength(12);
  });

  it("ships exactly 30 notion pages", () => {
    expect(NOTION_PAGES).toHaveLength(30);
  });

  it("ships exactly 50 hubspot accounts", () => {
    expect(HUBSPOT_ACCOUNTS).toHaveLength(50);
  });

  it("flags exactly 4 PII accounts", () => {
    expect(PII_ACCOUNT_IDS).toHaveLength(4);
  });
});

describe("@gsa/fixtures shape", () => {
  it("every ticket has stable required fields", () => {
    for (const t of TICKETS) {
      expect(t.id).toMatch(/^TCK-\d+$/);
      expect(t.requester.email).toContain("@");
      expect(["new", "open", "pending", "resolved", "closed"]).toContain(t.status);
      expect(["low", "normal", "high", "urgent"]).toContain(t.priority);
      expect(["tenant-A", "tenant-B"]).toContain(t.tenant);
    }
  });

  it("every notion page carries one of the four tags", () => {
    for (const p of NOTION_PAGES) {
      expect(["public", "support-kb", "internal", "eng-only"]).toContain(p.tag);
    }
  });

  it("notion tag mix is 10 public / 15 support-kb / 4 internal / 1 eng-only", () => {
    const byTag = NOTION_PAGES.reduce<Record<string, number>>((acc, p) => {
      acc[p.tag] = (acc[p.tag] ?? 0) + 1;
      return acc;
    }, {});
    expect(byTag).toEqual({ public: 10, "support-kb": 15, internal: 4, "eng-only": 1 });
  });

  it("every hubspot account has stable required fields", () => {
    for (const a of HUBSPOT_ACCOUNTS) {
      expect(a.id).toMatch(/^ACC-/);
      expect(a.primaryContact.email).toContain("@");
      expect(["free", "starter", "team", "enterprise"]).toContain(a.tier);
    }
  });
});

describe("@gsa/fixtures scenario hooks", () => {
  it("covers scenarios 1-8 at least once each in tickets", () => {
    const scenarios = new Set(TICKETS.map((t) => t.scenario).filter((n): n is number => !!n));
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(scenarios, `scenario ${n} missing a ticket hook`).toContain(n);
    }
  });

  it("ticket TCK-4 (scenario 4) contains the SSN pattern policies must redact", () => {
    const t4 = TICKETS.find((t) => t.id === "TCK-4");
    expect(t4).toBeDefined();
    expect(t4?.body).toMatch(/\d{3}-\d{2}-\d{4}/);
  });

  it("ticket TCK-5 (scenario 5) bait references destructive deletion", () => {
    const t5 = TICKETS.find((t) => t.id === "TCK-5");
    expect(t5?.body.toLowerCase()).toContain("wipe");
  });

  it("ticket TCK-8 (scenario 8) is a tenant-B principal referencing a tenant-A account", () => {
    const t8 = TICKETS.find((t) => t.id === "TCK-8");
    expect(t8?.tenant).toBe("tenant-B");
    expect(t8?.accountId).toBe("ACC-1");
  });

  it("Notion injection-payload page is in a permitted bucket (support-kb)", () => {
    const p = NOTION_PAGES.find((x) => x.id === INJECTION_PAYLOAD_PAGE_ID);
    expect(p).toBeDefined();
    expect(p?.tag).toBe("support-kb");
    expect(p?.body.toLowerCase()).toContain("ignore previous instructions");
  });

  it("PII accounts carry redaction-relevant patterns in their notes", () => {
    const piiAccounts = HUBSPOT_ACCOUNTS.filter((a) => PII_ACCOUNT_IDS.includes(a.id));
    expect(piiAccounts).toHaveLength(4);
    const ssn = piiAccounts.find((a) => /\d{3}-\d{2}-\d{4}/.test(a.notes));
    expect(ssn, "expected at least one PII account to embed an SSN-shaped pattern").toBeDefined();
    const card = piiAccounts.find((a) => /\d{4}-\d{4}-\d{4}-\d{4}/.test(a.notes));
    expect(
      card,
      "expected at least one PII account to embed a credit-card-shaped pattern",
    ).toBeDefined();
  });
});
