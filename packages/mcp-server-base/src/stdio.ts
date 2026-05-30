import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./server.js";
import type { ServerDef } from "./types.js";

export async function runStdio(def: ServerDef): Promise<void> {
  const server = buildMcpServer(def);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[${def.name}] stdio transport ready\n`);

  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      process.stderr.write(`[${def.name}] shutting down\n`);
      server.close().finally(() => resolve());
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}
