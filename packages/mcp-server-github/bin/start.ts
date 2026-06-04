#!/usr/bin/env node
import { runFromArgv } from "@gsa/mcp-server-base";
import { createGithubServer } from "../src/server.js";

const { def, state } = createGithubServer();
process.stderr.write(
  `[gsa-mcp-server-github] repo=${state.client.slug} mode=${state.client.live ? "live" : "mock"}\n`,
);
await runFromArgv(def, { defaultPort: 7005, defaultPath: "/mcp" });
