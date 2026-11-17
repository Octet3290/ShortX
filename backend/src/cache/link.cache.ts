import { cache } from './redis';

export interface CachedLink {
  id: string;
  destinationUrl: string;
  isActive: boolean;
  expiresAt: string | null;
}

const CACHE_TTL_SECONDS = 86400; // 24 hours

/**
 * Retrieves a shortened link from cache by shortCode.
 * Returns null on a cache miss.
 */
export const getCachedLink = async (shortCode: string): Promise<CachedLink | null> => {
  const data = await cache.get(`link:${shortCode}`);
  if (!data) return null;

  try {
    return JSON.parse(data) as CachedLink;
  } catch {
    return null;
  }
};

/**
 * Stores a link in cache with a 24-hour TTL.
 */
export const setCachedLink = async (
  shortCode: string,
  link: CachedLink,
  ttl = CACHE_TTL_SECONDS
): Promise<void> => {
  await cache.set(`link:${shortCode}`, JSON.stringify(link), ttl);
};

/**
 * Invalidates a shortCode cache entry immediately.
 * Must be called whenever a link is updated, deactivated, or deleted.
 */
export const invalidateCachedLink = async (shortCode: string): Promise<void> => {
  await cache.del(`link:${shortCode}`);
};
