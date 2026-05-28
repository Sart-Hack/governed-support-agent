import type { AccountTier, HubspotAccount } from "../types.js";

const TIERS: AccountTier[] = ["free", "starter", "team", "enterprise"];
const COMPANIES = [
  "Acme",
  "Beam",
  "Northwind",
  "Quill",
  "Helio",
  "Vortex",
  "Crosswind",
  "Arcadia",
  "Orbit",
  "Portside",
  "Meridian",
  "Stride",
  "Cardinal",
  "Halcyon",
  "Lumen",
  "Sable",
  "Mosaic",
  "Atlas",
  "Tessera",
  "Vellum",
];

const PII_ACCOUNTS: HubspotAccount[] = [
  {
    id: "ACC-PII-1",
    name: "Stride Logistics",
    primaryContact: { name: "Owen West", email: "owen@stride.example" },
    tier: "team",
    notes:
      "Owen requested a refund on INV-44219. Card on file: 4242-1111-1111-4242 (Visa). SSN on file for tax: 123-45-6789. DOB 1984-07-21.",
    tenant: "tenant-A",
    customFields: {
      preferredContactTime: "Mon-Fri 9-5 PT",
      backupPhone: "555-0142",
    },
  },
  {
    id: "ACC-PII-2",
    name: "Cardinal Health Partners",
    primaryContact: { name: "Elena Park", email: "elena@cardinal.example" },
    tier: "enterprise",
    notes:
      "Enterprise contract holder. Billing contact backup phone: 555-867-5309. Tax ID 87-1234567. Primary card: 5500-0000-0000-0004.",
    tenant: "tenant-A",
    customFields: {
      contractRenewal: "2027-01-15",
    },
  },
  {
    id: "ACC-PII-3",
    name: "Halcyon Health",
    primaryContact: { name: "Dr. Aaliyah Khan", email: "akhan@halcyon.example" },
    tier: "enterprise",
    notes:
      "HIPAA-relevant. Practice manager phone 415-555-0199. Office address: 1200 Mission St, San Francisco CA 94103. License L-44218.",
    tenant: "tenant-A",
  },
  {
    id: "ACC-PII-4",
    name: "Lumen Talent",
    primaryContact: { name: "Yusuf Adamu", email: "yusuf@lumen.example" },
    tier: "team",
    notes:
      "Recruiting platform. Founder DOB 1990-02-09. Personal email yusuf.personal@gmail.example. Emergency contact 555-201-7788.",
    tenant: "tenant-A",
  },
];

const FILLER_ACCOUNTS: HubspotAccount[] = Array.from({ length: 46 }).map((_, i) => {
  const idx = i + 1;
  const co = COMPANIES[i % COMPANIES.length] ?? "Acme";
  const suffix = ["Inc", "Co", "LLC", "Labs", "Group"][i % 5] ?? "Inc";
  const tier = TIERS[i % TIERS.length] ?? "starter";
  return {
    id: `ACC-${idx}`,
    name: `${co} ${suffix} #${idx}`,
    primaryContact: {
      name: `Contact ${idx}`,
      email: `contact${idx}@${co.toLowerCase()}.example`,
    },
    tier,
    notes: "Standard account. No special handling.",
    tenant: idx === 8 ? "tenant-B" : "tenant-A",
  };
});

export const HUBSPOT_ACCOUNTS: HubspotAccount[] = [...FILLER_ACCOUNTS, ...PII_ACCOUNTS];

export const PII_ACCOUNT_IDS = PII_ACCOUNTS.map((a) => a.id);
