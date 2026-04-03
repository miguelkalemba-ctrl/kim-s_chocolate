import { NextRequest, NextResponse } from "next/server";
import { getUpdatedAuditMetadata } from "@/lib/itemAudit";
import { normalizeItem } from "@/lib/itemNormalize";
import { requireSessionUser } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/store";
import { validateItemInput } from "@/lib/server/validators";

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

function purchaseStatusTemplate() {
  return [
    { name: "Quote Requested", done: true },
    { name: "Awaiting Proforma", done: false },
    { name: "Proforma Approved", done: false },
    { name: "Order Placed", done: false },
    { name: "In Transit", done: false },
    { name: "Delivered", done: false },
    { name: "Invoice Received", done: false },
    { name: "Invoice Paid", done: false },
    { name: "Order Complete", done: false },
  ];
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now();
  const reqId = requestId();
  const { id } = await params;
  const store = await readStore();
  const item = store.items.find((entry) => entry.id === id);
  if (!item) return timedJson({ error: "Not found" }, { status: 404 }, startedAt, reqId, "GET", `/api/items/${id}`);
  return timedJson({ item }, { status: 200 }, startedAt, reqId, "GET", `/api/items/${id}`);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now();
  const reqId = requestId();
  try {
    const user = requireSessionUser(request);
    const { id } = await params;
    const payload = await request.json();
    const validated = validateItemInput(payload);
    if (!validated.ok) return timedJson({ error: validated.error }, { status: 400 }, startedAt, reqId, "PUT", `/api/items/${id}`);

    const updated = await updateStore((store) => {
      const idx = store.items.findIndex((entry) => entry.id === id);
      if (idx === -1) throw new Error("NOT_FOUND");
      const current = store.items[idx];
      const nowIso = new Date().toISOString();

      const normalized = normalizeItem(
        {
          ...current,
          ...validated.value,
          ...getUpdatedAuditMetadata(current, user, "api-updated", nowIso),
        },
        purchaseStatusTemplate
      );

      if (!normalized) throw new Error("NORMALIZE_FAILED");

      const nextItems = [...store.items];
      nextItems[idx] = normalized;
      return { ...store, items: nextItems };
    });

    return timedJson({ ok: true, items: updated.items }, { status: 200 }, startedAt, reqId, "PUT", `/api/items/${id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return timedJson({ error: "Unauthorized" }, { status: 401 }, startedAt, reqId, "PUT", "/api/items/[id]");
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return timedJson({ error: "Not found" }, { status: 404 }, startedAt, reqId, "PUT", "/api/items/[id]");
    }
    return timedJson({ error: "Failed to update item" }, { status: 500 }, startedAt, reqId, "PUT", "/api/items/[id]");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now();
  const reqId = requestId();
  try {
    requireSessionUser(request);
    const { id } = await params;
    const updated = await updateStore((store) => ({
      ...store,
      items: store.items.filter((entry) => entry.id !== id),
    }));
    return timedJson({ ok: true, items: updated.items }, { status: 200 }, startedAt, reqId, "DELETE", `/api/items/${id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return timedJson({ error: "Unauthorized" }, { status: 401 }, startedAt, reqId, "DELETE", "/api/items/[id]");
    }
    return timedJson({ error: "Failed to delete item" }, { status: 500 }, startedAt, reqId, "DELETE", "/api/items/[id]");
  }
}
