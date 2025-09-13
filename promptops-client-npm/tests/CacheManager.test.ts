/**
 * Tests for CacheManager
 */

import { CacheManager, CacheError } from '../src';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager({
      memoryCacheSize: 100,
      defaultTTL: 5000,
      enableRedis: false, // Disable Redis for unit tests
    });
  });

  afterEach(async () => {
    await cacheManager.clear();
  });

  describe('set and get', () => {
    it('should store and retrieve values', async () => {
      const key = 'test-key';
      const value = { message: 'Hello, World!' };

      await cacheManager.set(key, value);
      const result = await cacheManager.get(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cacheManager.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should respect TTL', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await cacheManager.set(key, value, 100); // 100ms TTL

      // Should be available immediately
      const result1 = await cacheManager.get(key);
      expect(result1).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const result2 = await cacheManager.get(key);
      expect(result2).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing keys', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await cacheManager.set(key, value);
      expect(await cacheManager.get(key)).toBe(value);

      await cacheManager.delete(key);
      expect(await cacheManager.get(key)).toBeNull();
    });

    it('should return false for non-existent keys', async () => {
      const result = await cacheManager.delete('non-existent-key');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing keys', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await cacheManager.set(key, value);
      const result = await cacheManager.exists(key);

      expect(result).toBe(true);
    });

    it('should return false for non-existent keys', async () => {
      const result = await cacheManager.exists('non-existent-key');

      expect(result).toBe(false);
    });

    it('should return false for expired keys', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await cacheManager.set(key, value, 100); // 100ms TTL

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await cacheManager.exists(key);
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.set('key3', 'value3');

      expect(await cacheManager.exists('key1')).toBe(true);
      expect(await cacheManager.exists('key2')).toBe(true);
      expect(await cacheManager.exists('key3')).toBe(true);

      await cacheManager.clear();

      expect(await cacheManager.exists('key1')).toBe(false);
      expect(await cacheManager.exists('key2')).toBe(false);
      expect(await cacheManager.exists('key3')).toBe(false);
    });
  });

  describe('getKeys', () => {
    it('should return all keys', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.set('key3', 'value3');

      const keys = await cacheManager.getKeys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain(expect.stringContaining('key1'));
      expect(keys).toContain(expect.stringContaining('key2'));
      expect(keys).toContain(expect.stringContaining('key3'));
    });

    it('should filter keys by pattern', async () => {
      await cacheManager.set('test-key1', 'value1');
      await cacheManager.set('test-key2', 'value2');
      await cacheManager.set('other-key', 'value3');

      const keys = await cacheManager.getKeys('test');

      expect(keys).toHaveLength(2);
      expect(keys).toContain(expect.stringContaining('test-key1'));
      expect(keys).toContain(expect.stringContaining('test-key2'));
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const stats1 = cacheManager.getStats();
      expect(stats1.hits).toBe(0);
      expect(stats1.misses).toBe(0);
      expect(stats1.hitRate).toBe(0);

      await cacheManager.set('key1', 'value1');
      await cacheManager.get('key1'); // hit

      const stats2 = cacheManager.getStats();
      expect(stats2.hits).toBe(1);
      expect(stats2.misses).toBe(0);
      expect(stats2.hitRate).toBe(1);

      await cacheManager.get('non-existent-key'); // miss

      const stats3 = cacheManager.getStats();
      expect(stats3.hits).toBe(1);
      expect(stats3.misses).toBe(1);
      expect(stats3.hitRate).toBe(0.5);
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy cache', async () => {
      const result = await cacheManager.healthCheck();

      expect(result).toBe(true);
    });
  });

  describe('memory cache cleanup', () => {
    it('should remove expired entries', async () => {
      const manager = new CacheManager({
        memoryCacheSize: 3,
        defaultTTL: 100,
        enableRedis: false,
      });

      // Add entries that will expire
      await manager.set('key1', 'value1', 100);
      await manager.set('key2', 'value2', 100);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Add another entry (should trigger cleanup)
      await manager.set('key3', 'value3');

      expect(await manager.exists('key1')).toBe(false);
      expect(await manager.exists('key2')).toBe(false);
      expect(await manager.exists('key3')).toBe(true);
    });

    it('should remove oldest entries when exceeding size limit', async () => {
      const manager = new CacheManager({
        memoryCacheSize: 2,
        defaultTTL: 10000,
        enableRedis: false,
      });

      await manager.set('key1', 'value1');
      await manager.set('key2', 'value2');
      await manager.set('key3', 'value3'); // Should remove key1

      expect(await manager.exists('key1')).toBe(false);
      expect(await manager.exists('key2')).toBe(true);
      expect(await manager.exists('key3')).toBe(true);
    });
  });

  describe('key generation', () => {
    it('should generate consistent keys', async () => {
      const key1 = await cacheManager.getKeys();
      await cacheManager.set('test', 'value1');

      const key2 = await cacheManager.getKeys();
      await cacheManager.set('test', 'value2');

      const keys = await cacheManager.getKeys('test');
      expect(keys).toHaveLength(2); // Same key string, same hash
    });
  });

  describe('complex values', () => {
    it('should handle complex objects', async () => {
      const complexValue = {
        id: 1,
        name: 'Test',
        nested: {
          value: true,
          items: ['a', 'b', 'c'],
        },
      };

      await cacheManager.set('complex', complexValue);
      const result = await cacheManager.get('complex');

      expect(result).toEqual(complexValue);
    });

    it('should handle arrays', async () => {
      const arrayValue = [1, 2, 3, 'four', { five: 5 }];

      await cacheManager.set('array', arrayValue);
      const result = await cacheManager.get('array');

      expect(result).toEqual(arrayValue);
    });

    it('should handle null and undefined', async () => {
      await cacheManager.set('null-value', null);
      await cacheManager.set('undefined-value', undefined);

      expect(await cacheManager.get('null-value')).toBeNull();
      expect(await cacheManager.get('undefined-value')).toBeUndefined();
    });
  });
});