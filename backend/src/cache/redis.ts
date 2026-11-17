import Redis from 'ioredis';
import { env } from '../config/env';

/**
 * Resilient Redis client wrapper.
 * If Redis is unavailable or fails to connect, operations degrade gracefully
 * to an internal in-memory fallback cache so the application never crashes.
 */
class CacheManager {
  private redis: Redis | null = null;
  private isConnected = false;
  private memoryFallback = new Map<string, { value: string; expiresAt: number | null }>();

  constructor() {
    if (env.REDIS_URL && env.REDIS_URL !== 'none') {
      try {
        this.redis = new Redis(env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 2000,
          retryStrategy: () => null, // Don't hang in infinite reconnect loops if offline
        });

        this.redis.on('connect', () => {
          this.isConnected = true;
          console.log('⚡ Connected to Redis Cache');
        });

        this.redis.on('error', (err) => {
          this.isConnected = false;
          // Non-fatal warning: System falls back to in-memory/DB
          if (env.NODE_ENV !== 'test') {
            console.warn('⚠️ Redis offline or unreachable, using fallback cache:', err.message);
          }
        });

        // Attempt initial connection asynchronously
        this.redis.connect().catch(() => {
          this.isConnected = false;
        });
      } catch (err) {
        this.isConnected = false;
      }
    }
  }

  /**
   * Retrieves a cached string by key.
   */
  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.redis) {
      try {
        return await this.redis.get(key);
      } catch {
        // Fall through to memory fallback on error
      }
    }

    const item = this.memoryFallback.get(key);
    if (!item) return null;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.memoryFallback.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Sets a key with an optional TTL in seconds.
   */
  async set(key: string, value: string, ttlSeconds = 86400): Promise<void> {
    if (this.isConnected && this.redis) {
      try {
        await this.redis.set(key, value, 'EX', ttlSeconds);
        return;
      } catch {
        // Fall through to memory fallback on error
      }
    }

    this.memoryFallback.set(key, {
      value,
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  /**
   * Invalidates (deletes) a cached key.
   */
  async del(key: string): Promise<void> {
    if (this.isConnected && this.redis) {
      try {
        await this.redis.del(key);
      } catch {
        // Fall through
      }
    }

    this.memoryFallback.delete(key);
  }

  /**
   * Clears all cached items (useful for testing).
   */
  async flushAll(): Promise<void> {
    if (this.isConnected && this.redis) {
      try {
        await this.redis.flushall();
      } catch {
        // Fall through
      }
    }

    this.memoryFallback.clear();
  }

  /**
   * Disconnects the Redis connection if open.
   */
  disconnect(): void {
    if (this.redis) {
      try {
        this.redis.disconnect();
      } catch {
        // Ignore
      }
    }
  }
}

export const cache = new CacheManager();
export default cache;
