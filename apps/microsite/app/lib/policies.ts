import { loadDefaultPolicies } from "@gsa/policies";

// Parsed view of one Cedar policy, derived entirely from the .cedar file the
// agent enforces. The annotations (@id/@asi/@description) and the permit/forbid
// keyword are the source of truth; nothing here is hand-maintained per policy.
export type ParsedPolicy = {
  id: string; // "01-zendesk-read-only"
  num: string; // "01"
  title: string; // "Zendesk read only"
  filename: string;
  asiId: string; // "ASI02"
  asiName: string; // "Tool Misuse"
  description: string;
  effect: "permit" | "forbid";
  text: string; // full .cedar source
};

const ACRONYMS: Record<string, string> = {
  pii: "PII",
  kb: "KB",
  github: "GitHub",
  hubspot: "HubSpot",
  zendesk: "Zendesk",
  notion: "Notion",
  api: "API",
};

function prettifyTitle(slug: string): string {
  return slug
    .split("-")
    .map((word, i) => {
      if (ACRONYMS[word]) return ACRONYMS[word];
      return i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join(" ");
}

function annotation(text: string, name: string): string {
  const match = text.match(new RegExp(`@${name}\\("([^"]*)"\\)`));
  return match?.[1] ?? "";
}

export function getPolicies(): ParsedPolicy[] {
  return loadDefaultPolicies().map(({ id, filename, text }) => {
    const num = id.match(/^(\d+)/)?.[1] ?? "";
    const slug = id.replace(/^\d+-/, "");
    const asi = annotation(text, "asi"); // "ASI02 Tool Misuse"
    const [asiId, ...rest] = asi.split(" ");
    const effect: ParsedPolicy["effect"] = /\bforbid\s*\(/.test(text) ? "forbid" : "permit";
    return {
      id,
      num,
      title: prettifyTitle(slug),
      filename,
      asiId: asiId ?? "",
      asiName: rest.join(" "),
      description: annotation(text, "description"),
      effect,
      text,
    };
  });
}
