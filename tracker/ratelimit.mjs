// Tiny in-memory rate limiter: allow `max` hits per `windowMs` for each key.
export function createLimiter({ max, windowMs }) {
  const hits = new Map();
  return {
    // Returns true if this hit is allowed (and counts it).
    take(key) {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}
