export interface ExclusiveActionGate {
  tryStart(key: string): boolean;
  finish(key: string): void;
  isBusy(): boolean;
}

export function createExclusiveActionGate(): ExclusiveActionGate {
  let activeKey: string | null = null;

  return {
    tryStart(key: string): boolean {
      const normalized = key.trim();
      if (normalized.length === 0) return false;
      if (activeKey !== null) return false;
      activeKey = normalized;
      return true;
    },

    finish(key: string): void {
      if (activeKey === key.trim()) activeKey = null;
    },

    isBusy(): boolean {
      return activeKey !== null;
    }
  };
}
