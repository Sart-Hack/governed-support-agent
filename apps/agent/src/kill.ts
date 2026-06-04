import { PostgresKillSwitch, createKillSwitch } from "./kill-switch.js";

// `pnpm kill <on|off|status>` — the operator control surface (scenario 7).
// Flips the Postgres-backed flag the shield polls before every step.

async function main(): Promise<void> {
  const cmd = (process.argv[2] ?? "status").toLowerCase();
  const ks = createKillSwitch();

  if (!(ks instanceof PostgresKillSwitch)) {
    console.log("kill-switch: MASTRA_DATABASE_URL not set; nothing to toggle (no-op switch).");
    return;
  }

  if (cmd === "on") {
    await ks.trip("operator kill via CLI");
    console.log("kill-switch: ON — in-flight runs halt at the next step boundary.");
  } else if (cmd === "off") {
    await ks.reset();
    console.log("kill-switch: OFF");
  } else if (cmd !== "status") {
    console.log(`unknown command "${cmd}" (use on | off | status)`);
    process.exitCode = 2;
  }

  const s = await ks.status();
  console.log(
    `status: tripped=${s.tripped}${s.reason ? ` reason="${s.reason}"` : ""}${s.updatedAt ? ` at=${s.updatedAt}` : ""}`,
  );
  await ks.close();
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (err) => {
    console.error("kill error:", err);
    process.exit(1);
  },
);
