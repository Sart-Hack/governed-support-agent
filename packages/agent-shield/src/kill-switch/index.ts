export interface KillSwitch {
  isTripped(): Promise<boolean> | boolean;
  trip(reason: string): Promise<void> | void;
  reset(): Promise<void> | void;
}

export class NoopKillSwitch implements KillSwitch {
  isTripped(): boolean {
    return false;
  }
  trip(_reason: string): void {}
  reset(): void {}
}
