import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/server/auth";
import { updateStore } from "@/lib/server/store";

function requestId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function timedJson(
  body: unknown,
  init: ResponseInit,
  startedAt: number,
  reqId: string,
  method: string,
  path: string
) {
  const durationMs = Date.now() - startedAt;
  const response = NextResponse.json(body, init);
  response.headers.set("x-request-id", reqId);
  response.headers.set("x-duration-ms", String(durationMs));
  response.headers.set("server-timing", `app;dur=${durationMs}`);
  console.info(`[api] ${method} ${path} status=${init.status ?? 200} dur=${durationMs}ms req=${reqId}`);
  return response;
}

type SyncOperation = {
  type: "print-label" | "print-invoice";
  itemIds: string[];
};

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const reqId = requestId();
  try {
    const user = requireSessionUser(request);
    const body = (await request.json()) as { operations?: SyncOperation[] };
    const operations = Array.isArray(body?.operations) ? body.operations : [];

    const updated = await updateStore((store) => {
      const validOps = operations.filter(
        (entry) =>
          (entry.type === "print-label" || entry.type === "print-invoice") &&
          Array.isArray(entry.itemIds)
      );

      const queueEntries = validOps.map((entry, idx) => ({
        id: `sync-${Date.now()}-${idx}`,
        type: entry.type,
        itemIds: Array.from(new Set(entry.itemIds)),
        createdAt: Date.now(),
      }));

      return {
        ...store,
        queue: [...store.queue, ...queueEntries],
      };
    });

    return timedJson({
      ok: true,
      queued: updated.queue.length,
      appliedBy: user,
    }, { status: 200 }, startedAt, reqId, "POST", "/api/sync");
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return timedJson({ error: "Unauthorized" }, { status: 401 }, startedAt, reqId, "POST", "/api/sync");
    }
    return timedJson({ error: "Failed to apply sync operations" }, { status: 500 }, startedAt, reqId, "POST", "/api/sync");
  }
}
