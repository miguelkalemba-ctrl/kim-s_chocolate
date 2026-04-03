# Primary Roadmap — Camera to Item Delivery

This is now the **active primary to-do list**.
The previous MVP checklist is moved to deferred backlog until this delivery track is finished.

## Stage 1 — Camera Capture MVP (Web-first)

### 1) Instant camera mode
- ✅ Add “Camera Mode” action in app header
- ✅ Open rear camera stream (`facingMode: environment`) with one tap
- ✅ Keep stream active for fast repeated captures
- ✅ Show clear permission + fallback states (blocked/no camera)

### 2) Capture + tap metadata
- ✅ Capture photo to item draft
- ✅ Tap chips: Category (Furniture / Clothes / Electronics / Misc)
- ✅ Tap chips: Condition (Good / OK / Poor)
- ✅ Add quick fields: Location, notes, optional brand/material

### 3) Auto-create item
- ✅ Save captured data directly as new item
- ✅ Attach captured image(s) to item photos
- ✅ Show success toast and open item details

**Acceptance criteria**
- Staff can open camera, capture, classify, and create an item in under 10 seconds.

---

## Stage 2 — Label Printing

### 4) Label flow
- ✅ Add “Print Label” on freshly created camera item
- ✅ Add “Print Label” action in item details/list
- ✅ Generate compact label template (code, name, category, condition, price, date)
- ✅ Support single + multi-label print

**Acceptance criteria**
- Any created item can print a readable label from browser flow.

---

## Stage 3 — Price Suggestions (Memory-based)

### 5) Similar/repeat pricing engine
- ✅ Build rule-based similarity (category + condition + brand/material + recent prices)
- ✅ Suggest price range + one recommended price
- ✅ Show “why this suggestion” hint (transparent logic)
- ✅ Allow manual override before create/save

**Acceptance criteria**
- Suggestion appears during camera item creation and is editable.

---

## Stage 4 — Offline-first Operation

### 6) Reliable offline workflow
- ✅ Ensure camera capture and item creation fully work offline
- ✅ Queue prints/sync-safe actions where applicable
- ✅ Store local operations safely until connection returns

**Acceptance criteria**
- Core intake flow (capture → create item) works without internet.

---

## Stage 5 — Multi-user Simplicity

### 7) Team-safe usage basics
- ✅ Add simple login/session model
- ✅ Add user stamps on created/edited items
- ✅ Prepare conflict-safe sync strategy (last-write + audit trail)

**Acceptance criteria**
- Multiple staff can use the system with understandable ownership/history.

---

## Deferred Backlog (Resume Later)

### Current autonomous status
- ✅ Camera delivery track (Stages 1–5) completed and validated
- ✅ Architecture split started: extracted camera price suggestion engine to shared module + tests
- ✅ Architecture split continued: extracted item audit metadata logic to shared module + tests
- ✅ Architecture split continued: extracted label print document builder to shared module + tests
- ✅ Architecture split continued: extracted invoice document builder to shared module + tests
- ✅ Architecture split continued: extracted queued-operation helpers to shared module + tests
- ✅ Architecture split continued: extracted item defaults helpers (settings normalization + counter) to shared module + tests
- ✅ Architecture split continued: extracted item search suggestion/highlight helpers to shared module + tests
- ✅ Architecture split continued: extracted demo item factory to shared module + tests
- ✅ Architecture split continued: extracted item normalization helper to shared module + tests
- ✅ Architecture split continued: extracted camera capture controller helpers to shared module + tests
- ✅ Architecture split pass 1 complete: core business/helper logic moved to `lib/*` with regression coverage

### Previous MVP checklist status
- Phase 1: completed
- Phase 2: completed
- Remaining deferred: large modular refactor + backend/API + full mobile/store release track

### Paused TODO — Remaining Work

#### A) Modular refactor (continue after split pass 1)
- ✅ Split `app/page.tsx` into feature modules/components (`dashboard`, `items`, `camera`, `invoices`, `settings`)
- ✅ Move remaining UI/business helpers out of page into `lib/*` with unit tests
- ✅ Introduce a shared domain types file for `Item`, `Settings`, `Audit`, `Queue` types
- ✅ Add integration tests for camera → create item → print label/invoice flows

#### B) Backend/API foundation
- ✅ Define minimal data model (items, photos, audit entries, queued operations, users)
- ✅ Add API routes for CRUD items + audit append
- ✅ Add persistent storage (DB) and migration setup
- ✅ Add offline sync endpoint/strategy for queued operations replay
- ✅ Add server-side validation and auth guards on all write endpoints

#### C) Full mobile/store release track
- ✅ Decide packaging path (PWA-first vs native wrapper)
- ✅ Add installable/offline-capable app manifest + service worker hardening
- ✅ Implement mobile camera UX polish (touch targets, faster recapture, permission recovery)
- ✅ Add production build/release pipeline (envs, versioning, deploy checks)
- ✅ Prepare store/release checklist (privacy text, app icons, screenshots, support info)

When this camera delivery track is complete, resume deferred backlog from architecture split and backend foundation.
