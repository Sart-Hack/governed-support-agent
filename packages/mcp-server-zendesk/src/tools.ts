import { TICKETS, type Tenant, type ZendeskTicket } from "@gsa/fixtures";
import { type McpToolDef, notFound, ok } from "@gsa/mcp-server-base";
import { z } from "zod";

interface ReplyEvent {
  ticketId: string;
  kind: "internal" | "public";
  text: string;
  at: string;
}

interface StateChange {
  ticketId: string;
  status: ZendeskTicket["status"];
  at: string;
}

export interface ZendeskState {
  tickets: Map<string, ZendeskTicket>;
  replies: ReplyEvent[];
  stateChanges: StateChange[];
}

export function createState(): ZendeskState {
  const tickets = new Map<string, ZendeskTicket>();
  for (const t of TICKETS) tickets.set(t.id, { ...t });
  return { tickets, replies: [], stateChanges: [] };
}

export function tools(state: ZendeskState): McpToolDef[] {
  const listTickets: McpToolDef = {
    name: "listTickets",
    title: "List Zendesk tickets",
    description: "Return tickets filtered by status, priority, and/or tenant.",
    inputSchema: {
      status: z
        .enum(["new", "open", "pending", "resolved", "closed"])
        .optional()
        .describe("Filter by ticket status."),
      priority: z
        .enum(["low", "normal", "high", "urgent"])
        .optional()
        .describe("Filter by ticket priority."),
      tenant: z.string().optional().describe("Filter by tenant id, e.g. tenant-A."),
      limit: z.number().int().positive().max(100).optional().default(20),
    },
    requiredScopes: ["zendesk:read"],
    handler: async (input) => {
      const all = Array.from(state.tickets.values());
      const filtered = all.filter((t) => {
        if (input.status && t.status !== input.status) return false;
        if (input.priority && t.priority !== input.priority) return false;
        if (input.tenant && t.tenant !== (input.tenant as Tenant)) return false;
        return true;
      });
      return ok(filtered.slice(0, input.limit ?? 20));
    },
  };

  const getTicket: McpToolDef = {
    name: "getTicket",
    title: "Get a Zendesk ticket by ID",
    description: "Return a single ticket and its current state.",
    inputSchema: {
      id: z.string().describe("Zendesk ticket id, e.g. TCK-1"),
    },
    requiredScopes: ["zendesk:read"],
    handler: async ({ id }) => {
      const t = state.tickets.get(id);
      if (!t) return notFound(`ticket ${id} not found`);
      return ok(t);
    },
  };

  const replyInternal: McpToolDef = {
    name: "replyInternal",
    title: "Post an internal note on a ticket",
    description:
      "Add an internal note visible only to support staff. Does not notify the customer.",
    inputSchema: {
      ticketId: z.string(),
      text: z.string().min(1),
    },
    requiredScopes: ["zendesk:reply:internal"],
    handler: async ({ ticketId, text }) => {
      const t = state.tickets.get(ticketId);
      if (!t) return notFound(`ticket ${ticketId} not found`);
      const event: ReplyEvent = {
        ticketId,
        kind: "internal",
        text,
        at: new Date().toISOString(),
      };
      state.replies.push(event);
      return ok({ posted: event });
    },
  };

  const replyPublic: McpToolDef = {
    name: "replyPublic",
    title: "Post a customer-visible reply",
    description:
      "Send a customer-visible reply on the ticket. Must be gated by human approval upstream (Cedar policy 05).",
    inputSchema: {
      ticketId: z.string(),
      text: z.string().min(1),
    },
    requiredScopes: ["zendesk:reply:public"],
    handler: async ({ ticketId, text }) => {
      const t = state.tickets.get(ticketId);
      if (!t) return notFound(`ticket ${ticketId} not found`);
      const event: ReplyEvent = {
        ticketId,
        kind: "public",
        text,
        at: new Date().toISOString(),
      };
      state.replies.push(event);
      return ok({ posted: event });
    },
  };

  const closeTicket: McpToolDef = {
    name: "closeTicket",
    title: "Close a ticket",
    description: "Move a ticket into closed state.",
    inputSchema: {
      ticketId: z.string(),
    },
    requiredScopes: ["zendesk:write"],
    handler: async ({ ticketId }) => {
      const t = state.tickets.get(ticketId);
      if (!t) return notFound(`ticket ${ticketId} not found`);
      t.status = "closed";
      const change: StateChange = {
        ticketId,
        status: "closed",
        at: new Date().toISOString(),
      };
      state.stateChanges.push(change);
      return ok({ closed: change });
    },
  };

  return [listTickets, getTicket, replyInternal, replyPublic, closeTicket];
}
