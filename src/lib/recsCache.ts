/**
 * recsCache.ts
 * ─────────────────────────────────────────────────────
 * ใช้ clear localStorage cache ของ recommendations
 * และ broadcast event ให้ Index.tsx re-fetch อัตโนมัติ
 */

const CACHE_PREFIX = "recs:";

/** ลบ cache ของ user คนนี้ทุก genre combination */
export function clearUserRecsCache(userId?: string) {
  const prefix = `${CACHE_PREFIX}${userId ?? "guest"}:`;
  Object.keys(localStorage)
    .filter((k) => k.startsWith(prefix))
    .forEach((k) => localStorage.removeItem(k));

  // broadcast ให้ Index.tsx รู้ว่า recs ต้องอัปเดต
  window.dispatchEvent(new CustomEvent("recs:invalidate", { detail: { userId } }));
}

/** ลบ cache ทั้งหมด (ใช้ตอน logout) */
export function clearAllRecsCache() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(CACHE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}