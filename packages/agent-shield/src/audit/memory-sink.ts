import type { AuditEvent, AuditSink } from "./types.js";

export class InMemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = [];

  append(event: AuditEvent): void {
    this.events.push(event);
  }

  list(): readonly AuditEvent[] {
    return this.events;
  }

  clear(): void {
    this.events.length = 0;
  }
}
