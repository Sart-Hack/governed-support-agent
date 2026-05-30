#!/usr/bin/env node
import { runFromArgv } from "@gsa/mcp-server-base";
import { createHubspotServer } from "../src/server.js";

const { def } = createHubspotServer();
await runFromArgv(def, { defaultPort: 7004, defaultPath: "/mcp" });
