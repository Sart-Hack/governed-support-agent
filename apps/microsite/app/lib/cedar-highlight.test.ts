import { describe, expect, it } from "vitest";
import { tokenizeCedar } from "./cedar-highlight";

describe("tokenizeCedar", () => {
  it("reconstructs the exact source from its tokens (lossless)", () => {
    const source = `@asi("ASI02 Tool Misuse")\npermit (\n  principal in Role::"SupportLead",\n  action in [Action::"getTicket"],\n  resource is Ticket\n);\n`;
    const joined = tokenizeCedar(source)
      .map((t) => t.text)
      .join("");
    expect(joined).toBe(source);
  });

  it("classifies keywords, strings, annotations, and entities", () => {
    const tokens = tokenizeCedar('@asi("x") permit principal Role::"L"');
    const typeOf = (text: string) => tokens.find((t) => t.text === text)?.type;
    expect(typeOf("@asi")).toBe("annotation");
    expect(typeOf('"x"')).toBe("string");
    expect(typeOf("permit")).toBe("keyword");
    expect(typeOf("principal")).toBe("keyword");
    expect(typeOf("Role")).toBe("entity");
    expect(typeOf("::")).toBe("operator");
  });

  it("treats lowercase identifiers as plain, capitalized as entities", () => {
    const tokens = tokenizeCedar("when { resource.tag == public }");
    const typeOf = (text: string) => tokens.find((t) => t.text === text)?.type;
    expect(typeOf("when")).toBe("keyword");
    expect(typeOf("tag")).toBe("plain");
    expect(typeOf("==")).toBe("operator");
  });
});
