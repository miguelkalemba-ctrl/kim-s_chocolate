import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

const emptyStore = {
  schemaVersion: 1,
  items: [],
  settings: null,
  queue: [],
  updatedAt: new Date().toISOString(),
};

async function run() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);

    const migrated = {
      schemaVersion: 1,
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      settings: parsed?.settings && typeof parsed.settings === "object" ? parsed.settings : null,
      queue: Array.isArray(parsed?.queue) ? parsed.queue : [],
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(STORE_FILE, JSON.stringify(migrated, null, 2), "utf8");
    console.log("Store migration complete.");
  } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify(emptyStore, null, 2), "utf8");
    console.log("Created fresh store with schemaVersion 1.");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
