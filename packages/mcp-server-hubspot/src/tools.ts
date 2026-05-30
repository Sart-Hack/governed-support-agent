import { HUBSPOT_ACCOUNTS, type HubspotAccount } from "@gsa/fixtures";
import type { McpToolDef } from "@gsa/mcp-server-base";
import { z } from "zod";

export interface HubspotState {
  accounts: Map<string, HubspotAccount>;
  /** Records every deleteAccount *attempt* — succeeded or not. */
  deleteAttempts: { id: string; at: string; succeeded: boolean }[];
}

export function createState(): HubspotState {
  const accounts = new Map<string, HubspotAccount>();
  for (const a of HUBSPOT_ACCOUNTS) accounts.set(a.id, { ...a });
  return { accounts, deleteAttempts: [] };
}

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
}

function notFound(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function forbidden(message: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message, code: "forbidden_at_server" }),
      },
    ],
    isError: true,
  };
}

export function tools(state: HubspotState): McpToolDef[] {
  const getAccount: McpToolDef = {
    name: "getAccount",
    title: "Get a HubSpot account by ID",
    description:
      "Return account details, including unredacted notes. The caller (agent-shield) is responsible for applying the responseTransform=pii-redact step before passing the result to the LLM (enforced by Cedar policy 03).",
    inputSchema: { id: z.string().describe("Account id, e.g. ACC-1") },
    requiredScopes: ["hubspot:read"],
    handler: async ({ id }) => {
      const a = state.accounts.get(id);
      if (!a) return notFound(`account ${id} not found`);
      return ok(a);
    },
  };

  const listContacts: McpToolDef = {
    name: "listContacts",
    title: "List primary contacts for an account",
    description: "Return primary contact details for the named account.",
    inputSchema: { accountId: z.string() },
    requiredScopes: ["hubspot:read"],
    handler: async ({ accountId }) => {
      const a = state.accounts.get(accountId);
      if (!a) return notFound(`account ${accountId} not found`);
      return ok({ accountId, contacts: [a.primaryContact] });
    },
  };

  const deleteAccount: McpToolDef = {
    name: "deleteAccount",
    title: "Delete a HubSpot account (hard forbid)",
    description:
      "Advertised in the tool surface so Cedar policy 06 has a target to deny. Server-side this is also hard-forbidden — even if an upstream check is bypassed, the mock refuses to perform the deletion.",
    inputSchema: { id: z.string() },
    requiredScopes: ["hubspot:delete"],
    handler: async ({ id }) => {
      const at = new Date().toISOString();
      state.deleteAttempts.push({ id, at, succeeded: false });
      return forbidden(
        `deleteAccount is a will-not-automate action (trust-system.md §1 / policy 06). attempt recorded at ${at}.`,
      );
    },
  };

  return [getAccount, listContacts, deleteAccount];
}
