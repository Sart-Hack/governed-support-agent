import { NOTION_PAGES, type NotionPage, type NotionTag } from "@gsa/fixtures";
import { type McpToolDef, notFound, ok } from "@gsa/mcp-server-base";
import { z } from "zod";

export interface NotionState {
  pages: Map<string, NotionPage>;
}

export function createState(): NotionState {
  const pages = new Map<string, NotionPage>();
  for (const p of NOTION_PAGES) pages.set(p.id, p);
  return { pages };
}

export function tools(state: NotionState): McpToolDef[] {
  const search: McpToolDef = {
    name: "search",
    title: "Search Notion KB",
    description:
      "Full-text search across the Notion knowledge base. Supports an optional tag filter so callers can narrow to the buckets Cedar policy 02 permits (public, support-kb).",
    inputSchema: {
      query: z.string().min(1).describe("Free-text query."),
      tag: z
        .enum(["public", "support-kb", "internal", "eng-only"])
        .optional()
        .describe("Restrict results to a single tag bucket."),
      limit: z.number().int().positive().max(50).optional().default(10),
    },
    requiredScopes: ["notion:read"],
    handler: async (input) => {
      const q = input.query.toLowerCase();
      const tag = input.tag as NotionTag | undefined;
      // Token-overlap matching: a page matches when it shares at least one
      // meaningful word with the query, ranked by how many distinct query words
      // it contains. This behaves like real full-text search, so multi-word
      // queries (the agent passes a whole classification summary) actually
      // retrieve relevant pages instead of needing an exact substring.
      const terms = queryTerms(q);
      const scored = Array.from(state.pages.values())
        .filter((p) => !tag || p.tag === tag)
        .map((p) => ({ page: p, score: overlap(p, terms) }))
        .filter((s) => terms.length > 0 && s.score > 0)
        .sort((a, b) => b.score - a.score);
      const hits = scored.slice(0, input.limit ?? 10).map(({ page: p }) => ({
        id: p.id,
        title: p.title,
        tag: p.tag,
        excerpt: excerpt(p.body, firstTermIn(p, terms) ?? q, 160),
      }));
      return ok({ query: input.query, hits });
    },
  };

  const getPage: McpToolDef = {
    name: "getPage",
    title: "Get a Notion page by ID",
    description: "Return the full body of a single Notion page.",
    inputSchema: {
      id: z.string().describe("Page id, e.g. NTP-PUB-1"),
    },
    requiredScopes: ["notion:read"],
    handler: async ({ id }) => {
      const p = state.pages.get(id);
      if (!p) return notFound(`page ${id} not found`);
      return ok(p);
    },
  };

  return [search, getPage];
}

// Words too common to be useful search terms; dropped so a whole-sentence query
// doesn't match every page on filler words.
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "our",
  "are",
  "was",
  "this",
  "that",
  "from",
  "into",
  "will",
  "has",
  "have",
  "not",
  "but",
  "all",
  "any",
  "how",
  "when",
  "what",
  "who",
  "why",
  "where",
  "please",
  "should",
  "could",
  "would",
  "about",
  "use",
  "used",
  "using",
  "can",
  "help",
]);

function queryTerms(query: string): string[] {
  const seen = new Set<string>();
  for (const w of query.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length >= 3 && !STOPWORDS.has(w)) seen.add(w);
  }
  return [...seen];
}

function overlap(page: { title: string; body: string }, terms: string[]): number {
  const hay = `${page.title}\n${page.body}`.toLowerCase();
  let n = 0;
  for (const t of terms) if (hay.includes(t)) n++;
  return n;
}

function firstTermIn(page: { title: string; body: string }, terms: string[]): string | undefined {
  const hay = `${page.title}\n${page.body}`.toLowerCase();
  return terms.find((t) => hay.includes(t));
}

function excerpt(body: string, query: string, width: number): string {
  const lc = body.toLowerCase();
  const idx = lc.indexOf(query);
  if (idx === -1) return body.slice(0, width);
  const start = Math.max(0, idx - width / 4);
  return body.slice(start, start + width);
}
