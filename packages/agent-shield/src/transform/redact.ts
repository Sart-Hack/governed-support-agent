// Generic PII redaction. This is the executable half of Cedar policy 03
// (`responseTransform == "pii-redact"`): the policy permits a HubSpot read only
// because agent-shield will run this transform on the response. Detection is by
// shape, not by fixed values — any card-number- or SSN-shaped string is masked,
// so the same pass protects every account, not one scripted ticket.

export interface Redaction {
  /** The kind of PII detected: "card" or "ssn". */
  type: string;
  /** The value as it appears AFTER redaction, e.g. "****4242". */
  masked: string;
}

export interface RedactionResult {
  /** A deep clone of the input with every PII-shaped substring masked. */
  value: unknown;
  redactions: Redaction[];
}

// A card-shaped run: 13-19 digits, optionally grouped by single spaces or
// hyphens (Visa/Mastercard/Amex lengths). The length is re-checked after
// stripping separators so short hyphenated numbers (phones, dates) never match.
const CARD_RE = /\d(?:[ -]?\d){12,18}/g;
// A US SSN: 3-2-4 digit groups separated by hyphens.
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;

function redactString(input: string): { text: string; redactions: Redaction[] } {
  const redactions: Redaction[] = [];

  // SSN first (a fixed 3-2-4 shape the broad card matcher never reaches at 9
  // digits); doing it first keeps the two passes independent.
  let text = input.replace(SSN_RE, (m) => {
    const last4 = m.replace(/\D/g, "").slice(-4);
    const masked = `***-**-${last4}`;
    redactions.push({ type: "ssn", masked });
    return masked;
  });

  text = text.replace(CARD_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return m; // not card-shaped
    const masked = `****${digits.slice(-4)}`;
    redactions.push({ type: "card", masked });
    return masked;
  });

  return { text, redactions };
}

function redactValue(value: unknown, acc: Redaction[]): unknown {
  if (typeof value === "string") {
    const { text, redactions } = redactString(value);
    acc.push(...redactions);
    return text;
  }
  if (Array.isArray(value)) return value.map((v) => redactValue(v, acc));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactValue(v, acc);
    return out;
  }
  return value;
}

/** Deep-walk any value, masking every card- or SSN-shaped string it contains. */
export function redactPii(value: unknown): RedactionResult {
  const redactions: Redaction[] = [];
  const redacted = redactValue(value, redactions);
  return { value: redacted, redactions };
}
