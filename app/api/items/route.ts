import { NextRequest, NextResponse } from "next/server";
import { createAuditMetadata } from "@/lib/itemAudit";
import { normalizeItem } from "@/lib/itemNormalize";
import { requireSessionUser } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/store";
import { validateItemInput } from "@/lib/server/validators";
import { createDemoItems } from "@/lib/demoItems";

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

function nextCode(items: Array<{ code: string }>) {
  const max = items.reduce((n, item) => {
    const m = item.code.match(/KMC-(\d+)/i);
    const v = m ? Number(m[1]) : 0;
    return Number.isFinite(v) ? Math.max(n, v) : n;
  }, 0);
  return `KMC-${String(max + 1).padStart(4, "0")}`;
}

export async function GET() {
  const startedAt = Date.now();
  const reqId = requestId();
  let store = await readStore();

  if (store.items.length === 0) {
    // Seed server store with all demo items when empty (ensures real-time sync quickly works).
    const demoItems = createDemoItems(purchaseStatusTemplate);
    store = await updateStore((_) => ({ ..._, items: demoItems }));
  }

  return timedJson({ items: store.items, count: store.items.length }, { status: 200 }, startedAt, reqId, "GET", "/api/items");
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const reqId = requestId();
  try {
    const user = requireSessionUser(request);
    const payload = await request.json();
    const validated = validateItemInput(payload);
    if (!validated.ok) {
      return timedJson({ error: validated.error }, { status: 400 }, startedAt, reqId, "POST", "/api/items");
    }

    let createdItem: ReturnType<typeof normalizeItem> | null = null;

    const updated = await updateStore((store) => {
      const code = nextCode(store.items);
      const nowIso = new Date().toISOString();
      const normalized = normalizeItem(
        {
          ...validated.value,
          id: code,
          code,
          repairs: validated.value.repairs ?? purchaseStatusTemplate(),
          photos: validated.value.photos ?? [],
          condition: validated.value.condition ?? "Good",
          damageDescription: validated.value.damageDescription ?? "",
          notes: validated.value.notes ?? "",
          location: validated.value.location ?? "",
          repairLocation: validated.value.repairLocation ?? "",
          dateAdded: validated.value.dateAdded ?? nowIso.split("T")[0],
          brand: validated.value.brand ?? "",
          material: validated.value.material ?? "",
          sold: Boolean(validated.value.sold),
          ...createAuditMetadata(user, nowIso),
        },
        purchaseStatusTemplate
      );

      if (!normalized) {
        throw new Error("Invalid item payload after normalization");
      }

      createdItem = normalized;

      return {
        ...store,
        items: [normalized, ...store.items],
      };
    });

    return timedJson({ ok: true, item: createdItem, items: updated.items }, { status: 201 }, startedAt, reqId, "POST", "/api/items");
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return timedJson({ error: "Unauthorized" }, { status: 401 }, startedAt, reqId, "POST", "/api/items");
    }
    return timedJson({ error: "Failed to create item" }, { status: 500 }, startedAt, reqId, "POST", "/api/items");
  }
}
