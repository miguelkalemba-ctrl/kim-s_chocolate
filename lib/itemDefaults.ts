export function normalizeSettings<
  T extends {
    confirmBeforeDelete: boolean;
    autoOpenActivityLog: boolean;
  }
>(input: unknown, defaults: T): T {
  const source = (input && typeof input === "object" ? input : {}) as Partial<T>;
  return {
    ...defaults,
    ...source,
    confirmBeforeDelete:
      typeof source.confirmBeforeDelete === "boolean"
        ? source.confirmBeforeDelete
        : defaults.confirmBeforeDelete,
    autoOpenActivityLog:
      typeof source.autoOpenActivityLog === "boolean"
        ? source.autoOpenActivityLog
        : defaults.autoOpenActivityLog,
  };
}

export function getNextCounterFromItems(items: Array<{ code: string }>) {
  const maxCodeNumber = items.reduce((maxValue, item) => {
    const match = item.code.match(/KMC-(\d+)/i);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(maxValue, value) : maxValue;
  }, 0);
  return maxCodeNumber + 1;
}
