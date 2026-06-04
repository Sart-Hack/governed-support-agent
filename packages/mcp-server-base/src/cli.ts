import { runHttp } from "./http.js";
import { runStdio } from "./stdio.js";
import type { ServerDef } from "./types.js";

export interface RunFromArgvOptions {
  defaultPort: number;
  defaultPath?: string;
}

export async function runFromArgv(def: ServerDef, opts: RunFromArgvOptions): Promise<void> {
  const argv = process.argv.slice(2);
  const transportArg = argFor("--transport", argv) ?? process.env.MCP_TRANSPORT ?? "http";

  if (transportArg === "stdio") {
    await runStdio(def);
    return;
  }

  if (transportArg !== "http") {
    process.stderr.write(`unknown --transport ${transportArg} (expected stdio | http)\n`);
    process.exit(2);
  }

  const portArg = argFor("--port", argv) ?? process.env.MCP_PORT;
  const port = portArg ? Number(portArg) : opts.defaultPort;
  const host = argFor("--host", argv) ?? process.env.MCP_HOST ?? "0.0.0.0";
  const path = argFor("--path", argv) ?? process.env.MCP_PATH ?? opts.defaultPath ?? "/mcp";

  const handle = await runHttp(def, { port, host, path });

  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      process.stderr.write(`[${def.name}] shutting down\n`);
      handle.close().finally(() => resolve());
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}

function argFor(name: string, argv: string[]): string | undefined {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}
