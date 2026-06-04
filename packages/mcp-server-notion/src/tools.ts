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
      const matches = Array.from(state.pages.values()).filter((p) => {
        if (tag && p.tag !== tag) return false;
        return p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q);
      });
      const hits = matches.slice(0, input.limit ?? 10).map((p) => ({
        id: p.id,
        title: p.title,
        tag: p.tag,
        excerpt: excerpt(p.body, q, 160),
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

function excerpt(body: string, query: string, width: number): string {
  const lc = body.toLowerCase();
  const idx = lc.indexOf(query);
  if (idx === -1) return body.slice(0, width);
  const start = Math.max(0, idx - width / 4);
  return body.slice(start, start + width);
}
