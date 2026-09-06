/**
 * Short, human-readable order reference. Spoken over the phone during
 * support calls, so it avoids characters that sound or look alike
 * (0/O, 1/I/L, 5/S, 8/B).
 */
const ALPHABET = "23479ACDEFGHJKMNPQRTUVWXYZ";

export function generateOrderNumber(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `FD-${body}`;
}
