/**
 * Cache Manager for PromptOps Client
 */

import { CacheError, TelemetryError } from '../types/errors';
import { CacheConfig, CacheStats } from '../types';
import { createHash } from 'crypto';
import { promisify } from 'util';

// Redis types (optional dependency)
type RedisClient = any;
type RedisCommands = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode?: string, duration?: number) => Promise<'OK'>;
  del: (key: string) => Promise<number>;
  exists: (key: string) => Promise<number>;
  ttl: (key: string) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
  flushdb: () => Promise<'OK'>;
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>>;
  private redisClient?: RedisCommands;
  private config: Required<CacheConfig>;
  private stats: CacheStats;
  private isRedisConnected: boolean = false;

  constructor(config: CacheConfig = {}) {
    this.config = {
      memoryCacheSize: config.memoryCacheSize || 1000,
      redisUrl: config.redisUrl,
      defaultTTL: config.defaultTTL || 300000, // 5 minutes
      enableRedis: config.enableRedis ?? Boolean(config.redisUrl),
    };

    this.memoryCache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      hitRate: 0,
    };

    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    if (!this.config.enableRedis || !this.config.redisUrl) {
      return;
    }

    try {
      // Dynamic import for Redis (optional dependency)
      const { createClient } = await import('redis');
      const client = createClient({ url: this.config.redisUrl });

      this.redisClient = {
        get: promisify(client.get).bind(client),
        set: promisify(client.set).bind(client),
        del: promisify(client.del).bind(client),
        exists: promisify(client.exists).bind(client),
        ttl: promisify(client.ttl).bind(client),
        keys: promisify(client.keys).bind(client),
        flushdb: promisify(client.flushdb).bind(client),
      };

      await client.connect();
      this.isRedisConnected = true;
    } catch (error) {
      console.warn('Redis connection failed, falling back to memory cache:', error);
      this.config.enableRedis = false;
    }
  }

  private generateKey(parts: string[]): string {
    const keyString = parts.join(':');
    return createHash('sha256').update(keyString).digest('hex');
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    return now - entry.timestamp > entry.ttl;
  }

  private updateStats(hit: boolean): void {
    if (hit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }

    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    this.stats.size = this.memoryCache.size;
  }

  private cleanupMemoryCache(): void {
    if (this.memoryCache.size <= this.config.memoryCacheSize) {
      return;
    }

    // Remove expired entries first
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      }
    }

    // If still over size, remove oldest entries
    if (this.memoryCache.size > this.config.memoryCacheSize) {
      const entries = Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      const toRemove = entries.slice(0, this.memoryCache.size - this.config.memoryCacheSize);
      toRemove.forEach(([key]) => this.memoryCache.delete(key));
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.generateKey([key]);

    // Try Redis first
    if (this.config.enableRedis && this.redisClient && this.isRedisConnected) {
      try {
        const value = await this.redisClient.get(cacheKey);
        if (value) {
          const entry: CacheEntry<T> = JSON.parse(value);
          if (!this.isExpired(entry)) {
            this.updateStats(true);
            return entry.data;
          }
          // Remove expired entry
          await this.redisClient.del(cacheKey);
        }
      } catch (error) {
        console.warn('Redis get failed:', error);
      }
    }

    // Fall back to memory cache
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      this.updateStats(true);
      return memoryEntry.data;
    }

    // Remove expired entry from memory
    if (memoryEntry && this.isExpired(memoryEntry)) {
      this.memoryCache.delete(cacheKey);
    }

    this.updateStats(false);
    return null;
  }

  async set<T>(
    key: string,
    value: T,
    ttl: number = this.config.defaultTTL
  ): Promise<void> {
    const cacheKey = this.generateKey([key]);
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl,
    };

    // Store in Redis
    if (this.config.enableRedis && this.redisClient && this.isRedisConnected) {
      try {
        await this.redisClient.set(
          cacheKey,
          JSON.stringify(entry),
          'PX',
          ttl
        );
      } catch (error) {
        console.warn('Redis set failed:', error);
      }
    }

    // Store in memory cache
    this.memoryCache.set(cacheKey, entry);
    this.cleanupMemoryCache();
  }

  async delete(key: string): Promise<boolean> {
    const cacheKey = this.generateKey([key]);
    let deleted = false;

    // Delete from Redis
    if (this.config.enableRedis && this.redisClient && this.isRedisConnected) {
      try {
        const result = await this.redisClient.del(cacheKey);
        deleted = result > 0;
      } catch (error) {
        console.warn('Redis delete failed:', error);
      }
    }

    // Delete from memory cache
    const memoryDeleted = this.memoryCache.delete(cacheKey);
    deleted = deleted || memoryDeleted;

    return deleted;
  }

  async clear(): Promise<void> {
    // Clear Redis
    if (this.config.enableRedis && this.redisClient && this.isRedisConnected) {
      try {
        await this.redisClient.flushdb();
      } catch (error) {
        console.warn('Redis flush failed:', error);
      }
    }

    // Clear memory cache
    this.memoryCache.clear();
  }

  async exists(key: string): Promise<boolean> {
    const cacheKey = this.generateKey([key]);

    // Check Redis
    if (this.config.enableRedis && this.redisClient && this.isRedisConnected) {
      try {
        const exists = await this.redisClient.exists(cacheKey);
        if (exists > 0) {
          return true;
        }
      } catch (error) {
        console.warn('Redis exists failed:', error);
      }
    }

    // Check memory cache
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return true;
    }

    return false;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  async getKeys(pattern?: string): Promise<string[]> {
    const keys: string[] = [];

    // Get Redis keys
    if (this.config.enableRedis && this.redisClient && this.isRedisConnected) {
      try {
        const redisPattern = pattern ? `*${pattern}*` : '*';
        const redisKeys = await this.redisClient.keys(redisPattern);
        keys.push(...redisKeys);
      } catch (error) {
        console.warn('Redis keys failed:', error);
      }
    }

    // Get memory cache keys
    const memoryKeys = Array.from(this.memoryCache.keys());
    keys.push(...memoryKeys);

    // Return unique keys
    return Array.from(new Set(keys));
  }

  isRedisAvailable(): boolean {
    return this.isRedisConnected;
  }

  async healthCheck(): Promise<boolean> {
    if (this.config.enableRedis && this.redisClient && this.isRedisConnected) {
      try {
        await this.redisClient.get('health-check');
        return true;
      } catch (error) {
        this.isRedisConnected = false;
        return false;
      }
    }
    return true; // Memory cache is always healthy
  }
}