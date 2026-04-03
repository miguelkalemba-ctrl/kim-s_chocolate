import { describe, expect, it } from "vitest";
import { createQueuedOperation, shiftQueuedOperation, type QueuedOperation } from "../lib/operationQueue";

describe("operationQueue helpers", () => {
  it("creates a queued operation with unique item ids", () => {
    const operation = createQueuedOperation("print-label", ["a", "b", "a"]);

    expect(operation).not.toBeNull();
    expect(operation?.type).toBe("print-label");
    expect(operation?.itemIds).toEqual(["a", "b"]);
  });

  it("returns null when there are no item ids", () => {
    const operation = createQueuedOperation("print-invoice", []);
    expect(operation).toBeNull();
  });

  it("shifts the next queued operation", () => {
    const queue: QueuedOperation[] = [
      {
        id: "op-1",
        type: "print-label",
        itemIds: ["a"],
        createdAt: 1,
      },
      {
        id: "op-2",
        type: "print-invoice",
        itemIds: ["b"],
        createdAt: 2,
      },
    ];

    const { nextOperation, remaining } = shiftQueuedOperation(queue);
    expect(nextOperation?.id).toBe("op-1");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("op-2");
  });
});
