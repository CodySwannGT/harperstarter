/**
 * Opaque offset-cursor codec for Harper-native `search({ limit, offset })`
 * pagination.
 *
 * Packs a non-negative integer row offset into a URL-safe base64url token so a
 * resource can round-trip a page boundary through an opaque cursor without
 * exposing a numeric offset to clients. A torn or missing cursor decodes to
 * `0` (the first page) rather than throwing, so a malformed cursor degrades to
 * "start over" instead of 500-ing the request.
 */
import { Buffer } from "node:buffer";

/**
 * Encodes a non-negative integer offset into a URL-safe cursor token.
 * @param offset - Zero-based row offset to encode (clamped to a whole `>= 0`).
 * @returns Opaque base64url cursor token.
 */
export function encodeOffsetCursor(offset: number): string {
  return Buffer.from(String(Math.max(0, Math.trunc(offset))), "utf8").toString(
    "base64url"
  );
}

/**
 * Decodes an offset cursor produced by {@link encodeOffsetCursor}. Invalid or
 * missing cursors decode to `0` (first page).
 * @param cursor - Opaque cursor from the previous page, or null/undefined.
 * @returns A non-negative integer offset.
 */
export function decodeOffsetCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    // Reject partial-numeric payloads like "12x": `parseInt` would accept the
    // prefix and let a malformed cursor advance pagination.
    if (!/^\d+$/.test(raw)) return 0;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}
