// Minimal Cedar tokenizer for read-only display. Not a parser: it classifies
// spans for color, nothing more. Cedar policies here are single-line-string only
// (no multiline literals), so a per-chunk regex scan is enough.

export type CedarTokenType =
  | "comment"
  | "annotation"
  | "string"
  | "keyword"
  | "entity"
  | "operator"
  | "number"
  | "plain";

export type CedarToken = { text: string; type: CedarTokenType };

const KEYWORDS = new Set([
  "permit",
  "forbid",
  "when",
  "unless",
  "principal",
  "action",
  "resource",
  "context",
  "in",
  "is",
  "has",
  "like",
  "if",
  "then",
  "else",
  "true",
  "false",
]);

// Ordered alternation. Each branch is one capture group; group index → type.
const SCANNER =
  /(\/\/[^\n]*)|(@[A-Za-z]+)|("(?:[^"\\]|\\.)*")|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|>=|<=|&&|\|\||::|[=!<>+\-*/])|(\d+)/g;

export function tokenizeCedar(source: string): CedarToken[] {
  const tokens: CedarToken[] = [];
  let last = 0;

  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec walk
  for (let m: RegExpExecArray | null; (m = SCANNER.exec(source)) !== null; ) {
    if (m.index > last) {
      tokens.push({ text: source.slice(last, m.index), type: "plain" });
    }
    const [text] = m;
    if (m[1] !== undefined) tokens.push({ text, type: "comment" });
    else if (m[2] !== undefined) tokens.push({ text, type: "annotation" });
    else if (m[3] !== undefined) tokens.push({ text, type: "string" });
    else if (m[4] !== undefined) {
      if (KEYWORDS.has(text)) tokens.push({ text, type: "keyword" });
      else if (/^[A-Z]/.test(text)) tokens.push({ text, type: "entity" });
      else tokens.push({ text, type: "plain" });
    } else if (m[5] !== undefined) tokens.push({ text, type: "operator" });
    else if (m[6] !== undefined) tokens.push({ text, type: "number" });
    last = m.index + text.length;
  }
  if (last < source.length) {
    tokens.push({ text: source.slice(last), type: "plain" });
  }
  return tokens;
}

export const CEDAR_TOKEN_CLASS: Record<CedarTokenType, string> = {
  comment: "text-text-secondary italic",
  annotation: "text-policy",
  string: "text-success",
  keyword: "text-info",
  entity: "text-approval",
  operator: "text-text-secondary",
  number: "text-success",
  plain: "text-text-primary",
};
