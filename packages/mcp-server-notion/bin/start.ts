#!/usr/bin/env node
import { runFromArgv } from "@gsa/mcp-server-base";
import { createNotionServer } from "../src/server.js";

const { def } = createNotionServer();
await runFromArgv(def, { defaultPort: 7003, defaultPath: "/mcp" });
