# Release Strategy

## Packaging Decision

✅ **Chosen path: PWA-first**.

Rationale:
- Fastest route to production with existing Next.js stack.
- Reuses web camera and printing workflows.
- Enables installable app experience for desktop and mobile without full native rewrite.

## Execution Steps

1. Keep web app as primary runtime.
2. Maintain installable manifest + service worker caching.
3. Validate camera permissions and offline queue behavior on Android/iOS browsers.
4. Re-evaluate native wrapper only after stable PWA adoption.
