// A read-only, copy-pasteable code block. Server-renderable (no client JS): the
// whole point is fenced, selectable text, not an interactive editor. Used for
// shell commands (/run) and the agent-shield install + wrap snippet (/shield).
export function CodeBlock({ code, caption }: { code: string; caption?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/40">
      {caption ? (
        <div className="border-b border-border px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          {caption}
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-text-primary">
        <code>{code}</code>
      </pre>
    </div>
  );
}
