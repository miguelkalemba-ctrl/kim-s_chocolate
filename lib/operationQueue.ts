export type PrintOperationType = "print-invoice" | "print-label";

export type QueuedOperation = {
  id: string;
  type: PrintOperationType;
  itemIds: string[];
  createdAt: number;
};

export function createQueuedOperation(type: PrintOperationType, itemIds: string[]) {
  const uniqueIds = Array.from(new Set(itemIds));
  if (uniqueIds.length === 0) return null;

  return {
    id: `op-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    itemIds: uniqueIds,
    createdAt: Date.now(),
  } as QueuedOperation;
}

export function shiftQueuedOperation(queue: QueuedOperation[]) {
  if (queue.length === 0) {
    return {
      nextOperation: null,
      remaining: [] as QueuedOperation[],
    };
  }

  const [nextOperation, ...remaining] = queue;
  return {
    nextOperation,
    remaining,
  };
}
