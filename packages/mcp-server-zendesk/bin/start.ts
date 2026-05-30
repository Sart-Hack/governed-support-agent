#!/usr/bin/env node
import { runFromArgv } from "@gsa/mcp-server-base";
import { createZendeskServer } from "../src/server.js";

const { def } = createZendeskServer();
await runFromArgv(def, { defaultPort: 7002, defaultPath: "/mcp" });
