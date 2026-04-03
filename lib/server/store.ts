import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Redis } from "@upstash/redis";
import type { ServerStore } from "@/lib/types";

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "kmc-data")
  : path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const SCHEMA_VERSION = 1;
const REDIS_STORE_KEY = "kwt:store:v1";

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  if (!redisClient) {
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

const EMPTY_STORE: ServerStore = {
  schemaVersion: SCHEMA_VERSION,
  items: [],
  settings: null,
  queue: [],
  updatedAt: new Date().toISOString(),
};

function migrateStore(raw: unknown): ServerStore {
  if (!raw || typeof raw !== "object") return EMPTY_STORE;
  const source = raw as Partial<ServerStore>;

  return {
    schemaVersion: SCHEMA_VERSION,
    items: Array.isArray(source.items) ? source.items : [],
    settings: source.settings && typeof source.settings === "object" ? source.settings : null,
    queue: Array.isArray(source.queue) ? source.queue : [],
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
  };
}

export async function readStore(): Promise<ServerStore> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get<unknown>(REDIS_STORE_KEY);
      if (!raw) return EMPTY_STORE;

      if (typeof raw === "string") {
        const parsed = JSON.parse(raw);
        return migrateStore(parsed);
      }

      return migrateStore(raw);
    } catch {
      return EMPTY_STORE;
    }
  }

  try {
    const content = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(content);
    return migrateStore(parsed);
  } catch {
    return EMPTY_STORE;
  }
}

export async function writeStore(nextStore: ServerStore) {
  const redis = getRedisClient();
  if (redis) {
    await redis.set(REDIS_STORE_KEY, { ...nextStore, updatedAt: new Date().toISOString() });
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    STORE_FILE,
    JSON.stringify({ ...nextStore, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

export async function updateStore(
  updater: (current: ServerStore) => ServerStore | Promise<ServerStore>
): Promise<ServerStore> {
  const current = await readStore();
  const next = await updater(current);
  await writeStore(next);
  return next;
}
