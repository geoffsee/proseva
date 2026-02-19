// Simple in-memory rate limiter
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function withRateLimit(
  request: Request,
  key: string,
  maxRequests: number,
): Promise<void> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1";
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();

  let bucket = buckets.get(bucketKey);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(bucketKey, bucket);
  }

  bucket.count++;
  if (bucket.count > maxRequests) {
    throw new Error("API rate limit exceeded");
  }
}
