import { describe, expect, it } from "vitest";
import { applyResponseTransform, redactPii } from "./index.js";

const RAW_CARD = "4242-1111-1111-4242";
const RAW_SSN = "123-45-6789";

describe("redactPii", () => {
  it("masks a card number to its last four digits", () => {
    const { value, redactions } = redactPii(`Card on file: ${RAW_CARD} (Visa).`);
    expect(value).toBe("Card on file: ****4242 (Visa).");
    expect(value).not.toContain(RAW_CARD);
    expect(redactions).toContainEqual({ type: "card", masked: "****4242" });
  });

  it("masks an SSN keeping only the last four digits", () => {
    const { value, redactions } = redactPii(`SSN ${RAW_SSN} on file`);
    expect(value).toBe("SSN ***-**-6789 on file");
    expect(value).not.toContain(RAW_SSN);
    expect(redactions).toContainEqual({ type: "ssn", masked: "***-**-6789" });
  });

  it("redacts both card and SSN inside a nested object without mutating shape", () => {
    const input = {
      id: "ACC-PII-1",
      notes: `Refund. Card on file: ${RAW_CARD}. SSN on file for tax: ${RAW_SSN}.`,
      tier: "team",
    };
    const { value, redactions } = redactPii(input);
    const out = value as typeof input;
    expect(out.id).toBe("ACC-PII-1");
    expect(out.tier).toBe("team");
    expect(out.notes).not.toContain(RAW_CARD);
    expect(out.notes).not.toContain(RAW_SSN);
    expect(out.notes).toContain("****4242");
    expect(out.notes).toContain("***-**-6789");
    expect(redactions.map((r) => r.type).sort()).toEqual(["card", "ssn"]);
    // The original is untouched (deep clone).
    expect(input.notes).toContain(RAW_CARD);
  });

  it("leaves non-PII digit strings (phones, dates, invoices) alone", () => {
    const input = "Invoice INV-44219, backup phone 555-0142, DOB 1984-07-21, zip 94103.";
    const { value, redactions } = redactPii(input);
    expect(value).toBe(input);
    expect(redactions).toHaveLength(0);
  });
});

describe("applyResponseTransform", () => {
  it("dispatches pii-redact and reports redactions", () => {
    const { value, redactions } = applyResponseTransform("pii-redact", { notes: RAW_CARD });
    expect((value as { notes: string }).notes).toBe("****4242");
    expect(redactions).toHaveLength(1);
  });

  it("is a no-op for an unknown transform", () => {
    const { value, redactions } = applyResponseTransform("nope", { notes: RAW_CARD });
    expect((value as { notes: string }).notes).toBe(RAW_CARD);
    expect(redactions).toHaveLength(0);
  });
});
