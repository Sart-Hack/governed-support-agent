#!/usr/bin/env node
// Registers the three mock MCP servers as Bifrost MCP clients so a fresh clone
// gets a working multi-MCP gateway without manual API calls. Bifrost persists
// MCP-client state in infra/bifrost/config.db (SQLite, gitignored), so this
// script is the canonical, version-controlled source of that registration.
//
// Idempotent by reconciliation: Bifrost makes connection_string immutable on an
// existing client and masks it in GET responses, so we cannot diff in place.
// Instead we delete any client carrying one of our names, then recreate all
// three. The end state is deterministic on every run.
//
// Usage:  node scripts/bootstrap-bifrost.mjs
// Env:    BIFROST_URL                (default http://localhost:8080)
//         MCP_ZENDESK_GATEWAY_URL    (default http://host.docker.internal:7002/mcp)
//         MCP_NOTION_GATEWAY_URL     (default http://host.docker.internal:7003/mcp)
//         MCP_HUBSPOT_GATEWAY_URL    (default http://host.docker.internal:7004/mcp)
//
// Bifrost reaches the host-process MCP servers via host.docker.internal — hence
// the gateway URLs differ from the localhost URLs a host client would use.

const BIFROST_URL = process.env.BIFROST_URL ?? "http://localhost:8080";

// Bifrost MCP-client names cannot contain hyphens (spike gotcha) — use underscores.
const CLIENTS = [
  {
    name: "mock_zendesk",
    url: process.env.MCP_ZENDESK_GATEWAY_URL ?? "http://host.docker.internal:7002/mcp",
  },
  {
    name: "mock_notion",
    url: process.env.MCP_NOTION_GATEWAY_URL ?? "http://host.docker.internal:7003/mcp",
  },
  {
    name: "mock_hubspot",
    url: process.env.MCP_HUBSPOT_GATEWAY_URL ?? "http://host.docker.internal:7004/mcp",
  },
];

const DESIRED_NAMES = new Set(CLIENTS.map((c) => c.name));

async function api(path, init) {
  const res = await fetch(`${BIFROST_URL}${path}`, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  // 1. Confirm Bifrost is reachable.
  const health = await api("/api/mcp/clients", {}).catch((err) => {
    throw new Error(`cannot reach Bifrost at ${BIFROST_URL}: ${err.message}`);
  });
  if (!health.ok) {
    throw new Error(
      `Bifrost /api/mcp/clients returned ${health.status}: ${JSON.stringify(health.body)}`,
    );
  }

  // 2. Delete any existing client carrying one of our names.
  const existing = health.body?.clients ?? [];
  for (const client of existing) {
    const name = client?.config?.name;
    const id = client?.config?.client_id;
    if (DESIRED_NAMES.has(name) && id) {
      const del = await api(`/api/mcp/client/${id}`, { method: "DELETE" });
      console.log(
        `  reconcile: removed stale "${name}" (${del.ok ? "ok" : `status ${del.status}`})`,
      );
    }
  }

  // 3. Recreate all three.
  let connected = 0;
  for (const client of CLIENTS) {
    const res = await api("/api/mcp/client", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: client.name,
        connection_type: "http",
        connection_string: client.url,
      }),
    });
    if (res.ok) {
      console.log(`  registered ${client.name} -> ${client.url}`);
      connected += 1;
    } else {
      console.error(`  FAILED ${client.name}: status ${res.status} ${JSON.stringify(res.body)}`);
    }
  }

  // 4. Report final connection state.
  const after = await api("/api/mcp/clients", {});
  const states = (after.body?.clients ?? [])
    .filter((c) => DESIRED_NAMES.has(c?.config?.name))
    .map((c) => `${c.config.name}=${c.state}`)
    .join(" ");
  console.log(`\nBifrost MCP clients: ${states || "(none)"}`);

  if (connected !== CLIENTS.length) {
    process.exitCode = 1;
    console.error(`\nExpected ${CLIENTS.length} registrations, got ${connected}.`);
    return;
  }
  console.log(
    "\nBootstrap complete. Start the MCP servers (pnpm mcp:servers) for them to connect.",
  );
}

main().catch((err) => {
  console.error(`bootstrap-bifrost failed: ${err.message}`);
  process.exitCode = 1;
});
