import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface PolicyFile {
  id: string;
  filename: string;
  text: string;
}

const POLICY_FILES = [
  "01-zendesk-read-only.cedar",
  "02-notion-tag-filtered.cedar",
  "03-hubspot-pii-redacted.cedar",
  "04-github-write-scoped.cedar",
  "05-customer-facing-requires-approval.cedar",
  "06-delete-account-never.cedar",
  "07-tenant-isolation.cedar",
  "08-customer-reply-after-approval.cedar",
] as const;

export type PolicyFilename = (typeof POLICY_FILES)[number];

function policiesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "policies");
}

export function loadDefaultPolicies(): PolicyFile[] {
  const dir = policiesDir();
  return POLICY_FILES.map((filename) => {
    const text = readFileSync(join(dir, filename), "utf8");
    const id = filename.replace(/\.cedar$/, "");
    return { id, filename, text };
  });
}

export function policyFileNames(): readonly PolicyFilename[] {
  return POLICY_FILES;
}
