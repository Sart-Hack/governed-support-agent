import { type KillSwitch, NoopKillSwitch } from "@sarthak/agent-shield";
import pg from "pg";

/**
 * A kill-switch backed by a single Postgres row. The shield polls isTripped()
 * before every step, so flipping this flag (via `pnpm kill on`) halts an
 * in-flight run at the next step boundary and the halt is durable across
 * processes and restarts — not in-memory state that a restart would clear.
 */
export class PostgresKillSwitch implements KillSwitch {
  private readonly pool: pg.Pool;
  private readonly ready: Promise<void>;

  constructor(
    connectionString: string,
    private readonly scope = "global",
  ) {
    this.pool = new pg.Pool({ connectionString });
    this.ready = this.ensureTable();
  }

  private async ensureTable(): Promise<void> {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS agent_kill_switch (
         scope text PRIMARY KEY,
         tripped boolean NOT NULL DEFAULT false,
         reason text,
         updated_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
  }

  async isTripped(): Promise<boolean> {
    await this.ready;
    const r = await this.pool.query<{ tripped: boolean }>(
      "SELECT tripped FROM agent_kill_switch WHERE scope = $1",
      [this.scope],
    );
    return r.rows[0]?.tripped === true;
  }

  async trip(reason: string): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO agent_kill_switch (scope, tripped, reason, updated_at)
       VALUES ($1, true, $2, now())
       ON CONFLICT (scope) DO UPDATE SET tripped = true, reason = $2, updated_at = now()`,
      [this.scope, reason],
    );
  }

  async reset(): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO agent_kill_switch (scope, tripped, reason, updated_at)
       VALUES ($1, false, null, now())
       ON CONFLICT (scope) DO UPDATE SET tripped = false, reason = null, updated_at = now()`,
      [this.scope],
    );
  }

  async status(): Promise<{ tripped: boolean; reason?: string; updatedAt?: string }> {
    await this.ready;
    const r = await this.pool.query<{ tripped: boolean; reason: string | null; updated_at: Date }>(
      "SELECT tripped, reason, updated_at FROM agent_kill_switch WHERE scope = $1",
      [this.scope],
    );
    const row = r.rows[0];
    return {
      tripped: row?.tripped === true,
      reason: row?.reason ?? undefined,
      updatedAt: row?.updated_at?.toISOString(),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export type ManagedKillSwitch = KillSwitch & { close?(): Promise<void> };

/** Postgres-backed when MASTRA_DATABASE_URL is set, else a no-op (offline/tests). */
export function createKillSwitch(env: NodeJS.ProcessEnv = process.env): ManagedKillSwitch {
  const url = env.MASTRA_DATABASE_URL;
  return url ? new PostgresKillSwitch(url) : new NoopKillSwitch();
}
