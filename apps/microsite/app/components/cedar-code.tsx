import { CEDAR_TOKEN_CLASS, tokenizeCedar } from "../lib/cedar-highlight";

// Read-only, syntax-highlighted Cedar source. Server-renderable: the tokenizer is
// pure, so this ships no client JS.
export function CedarCode({ source }: { source: string }) {
  const tokens = tokenizeCedar(source);
  return (
    <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
      <code>
        {tokens.map((token, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: token stream is static
          <span key={i} className={CEDAR_TOKEN_CLASS[token.type]}>
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  );
}
