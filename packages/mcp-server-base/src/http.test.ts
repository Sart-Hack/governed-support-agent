import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runHttp } from "./http.js";
import type { ServerDef } from "./types.js";

const def: ServerDef = {
  name: "test-server",
  version: "0.0.0",
  tools: [
    {
      name: "echo",
      description: "Echo back the input string.",
      inputSchema: { value: z.string() },
      requiredScopes: ["test:read"],
      handler: async ({ value }) => ({
        content: [{ type: "text" as const, text: JSON.stringify({ echoed: value }) }],
      }),
    },
  ],
};

async function postJsonRpc(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

async function readSseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  const match = text.match(/^data: (.*)$/m);
  if (!match || !match[1]) throw new Error(`no SSE data frame in: ${text.slice(0, 200)}`);
  return JSON.parse(match[1]);
}

describe("mcp-server-base http transport", () => {
  it("responds to initialize and lists the registered tool with its scope _meta", async () => {
    const handle = await runHttp(def, { port: 0, host: "127.0.0.1", path: "/mcp" });
    const url = `http://127.0.0.1:${handle.port}/mcp`;

    try {
      const initRes = await postJsonRpc(url, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "vitest", version: "0.0.0" },
        },
      });
      expect(initRes.status).toBe(200);
      const initBody = (await readSseJson(initRes)) as {
        result: { serverInfo: { name: string } };
      };
      expect(initBody.result.serverInfo.name).toBe("test-server");

      const listRes = await postJsonRpc(url, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });
      expect(listRes.status).toBe(200);
      const listBody = (await readSseJson(listRes)) as {
        result: { tools: { name: string; _meta?: Record<string, unknown> }[] };
      };
      expect(listBody.result.tools.map((t) => t.name)).toContain("echo");
      const echo = listBody.result.tools.find((t) => t.name === "echo");
      expect(echo?._meta?.["agent-shield/requiredScopes"]).toEqual(["test:read"]);
    } finally {
      await handle.close();
    }
  });
});
