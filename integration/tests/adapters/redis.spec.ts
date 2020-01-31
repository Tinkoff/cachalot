import { v4 as uuid } from 'uuid';
import Redis, { Redis as RedisType } from 'ioredis';
import RedisStorageAdapter, { CACHE_PREFIX } from '../../../src/adapters/redis';
import { ConnectionStatus } from '../../../src/connection-status';

let redis: RedisType;
let adapter: RedisStorageAdapter;

function delay(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration + 1));
}

const expireTimeout = 5;

describe('Redis adapter', () => {
  beforeAll(() => {
    redis = new Redis();
    adapter = new RedisStorageAdapter(redis, { lockExpireTimeout: expireTimeout });
  });

  afterAll(() => {
    redis.disconnect();
  });

  it('Sets connection status to "connected" if redis executes some command', async () => {
    await redis.get('');
    expect(adapter.getConnectionStatus()).toEqual(ConnectionStatus.CONNECTED);
  });

  describe('set', () => {
    it('set returns true if operation is successful', async () => {
      const key = uuid();
      const value = uuid();

      await expect(adapter.set(key, value)).resolves.toEqual(true);
      await expect(adapter.get(key)).resolves.toEqual(value);
    });

    it('set adds cache prefix', async () => {
      const key = uuid();
      const value = uuid();

      await adapter.set(key, value);

      await expect(redis.get(`${CACHE_PREFIX}:${key}`)).resolves.toEqual(value);
    });

    it('set calls set with cache prefix and PX mode when expires set', async () => {
      const key = uuid();
      const value = uuid();

      await adapter.set(key, value, expireTimeout);
      await delay(expireTimeout);
      await expect(redis.get(`${CACHE_PREFIX}:${key}`)).resolves.toBeNull();
    });
  });

  describe('get', () => {
    it('get returns value', async () => {
      const key = uuid();
      const value = uuid();

      await expect(adapter.set(key, value));
      await expect(adapter.get(key)).resolves.toEqual(value);
    });

    it('get returns null if key does not set', async () => {
      const key = uuid();
      await expect(adapter.get(key)).resolves.toBeNull();
    });

    it('get adds cache prefix', async () => {
      const key = uuid();
      const value = uuid();
      await redis.set(`${CACHE_PREFIX}:${key}`, value);

      await expect(adapter.get(key)).resolves.toEqual(value);
    });
  });

  describe('del', () => {
    it('del calls del with cache prefix', async () => {
      const key = uuid();
      const value = uuid();

      await redis.set(`${CACHE_PREFIX}:${key}`, value);
      await adapter.del(key);

      await expect(redis.get(`${CACHE_PREFIX}:${key}`)).resolves.toBeNull();
    });

    it('del does nothing if key does not exist', async () => {
      const key = uuid();
      const keyWithPrefix = `${CACHE_PREFIX}:${key}`;

      await expect(redis.get(keyWithPrefix)).resolves.toBeNull();
      await adapter.del(key);
      await expect(redis.get(keyWithPrefix)).resolves.toBeNull();
    });
  });

  describe('acquireLock', () => {
    it('acquireLock returns true if lock is successful', async () => {
      const key = uuid();
      const lockResult = await adapter.acquireLock(key);

      expect(lockResult).toEqual(true);
    });

    it('acquireLock calls set with generated key name and in NX mode', async () => {
      const key = uuid();
      const lockResult = await adapter.acquireLock(key);

      expect(lockResult).toEqual(true);
      await delay(expireTimeout);

      await (expect(redis.get(`${key}_lock`))).resolves.toBeNull();
    });
  });

  describe('releaseLock', () => {
    it('releaseLock returns false if lock does not exist', async () => {
      const key = uuid();
      const releaseLockResult = await adapter.releaseLock(key);
      expect(releaseLockResult).toEqual(false);
    });

    it('releaseLock delete lock record with appropriate key, and returns true on success', async () => {
      const key = uuid();

      await redis.set(`${key}_lock`, '');
      const releaseLockResult = await adapter.releaseLock(key);
      expect(releaseLockResult).toEqual(true);
    });

    it('releaseLock delete lock record set by acquireLock', async () => {
      const key = uuid();

      await adapter.acquireLock(key);

      await expect(adapter.releaseLock(key)).resolves.toEqual(true);
    });
  });

  describe('isLockExists', () => {
    it('isLockExists returns true if lock exists', async () => {
      const key = uuid();

      await adapter.acquireLock(key);
      await expect(adapter.isLockExists(key)).resolves.toEqual(true);
    });

    it('isLockExists returns false if lock does not exist', async () => {
      const key = uuid();

      await expect(adapter.isLockExists(key)).resolves.toEqual(false);
    });
  });

  describe('mset', () => {
    it('mset sets values', async () => {
      const values = new Map([
        [uuid(), uuid()],
        [uuid(), uuid()]
      ]);
      await adapter.mset(values);

      for (const [key, value] of values.entries()) {
        await expect(redis.get(`${CACHE_PREFIX}:${key}`)).resolves.toEqual(value);
      }
    });

    it('mset throws error on empty values', async () => {
      await expect(adapter.mset(new Map<string, any>())).rejects.toThrowError('ERR wrong number of arguments for \'mset\' command');
    });
  });

  describe('mget', () => {
    it('mget gets values', async () => {
      const values = new Map([
        [uuid(), uuid()],
        [uuid(), uuid()]
      ]);

      for (const [key, value] of values.entries()) {
        await redis.set(`${CACHE_PREFIX}:${key}`, value);
      }

      const result = await adapter.mget(Array.from(values.keys()));

      expect(result).toEqual(Array.from(values.values()));
    });

    it('mget returns null for non-existing keys', async () => {
      const values = new Map([
        [uuid(), uuid()],
        [uuid(), uuid()]
      ]);

      for (const [key, value] of values.entries()) {
        await redis.set(`${CACHE_PREFIX}:${key}`, value);
      }

      const keys = Array.from(values.keys());
      const nonExistingKey = uuid();
      keys.push(nonExistingKey);

      const result = await adapter.mget(keys);

      expect(result).toEqual([...Array.from(values.values()), null]);
    });

    it('fails if empty values passed', async () => {
      await expect(adapter.mget([])).rejects.toThrowError('wrong number of arguments for \'mget\' command');
    });
  });

  describe('getSetValues', () => {
    it('returns values', async () => {
      const key = uuid();
      const value = uuid();

      await redis.sadd(`${CACHE_PREFIX}:${key}`, value);

      await expect(adapter.getSetValues(key)).resolves.toEqual(new Set([value]));
    });

    it('returns empty set for unknown key', async () => {
      const key = uuid();

      await expect(adapter.getSetValues(key)).resolves.toEqual(new Set([]));
    });
  });

  describe('addToSet', () => {
    it('adds value to set', async () => {
      const key = uuid();
      const value = uuid();

      await adapter.addToSet(key, [value]);

      await expect(redis.smembers(`${CACHE_PREFIX}:${key}`)).resolves.toEqual([value]);
    });

    it('fails if empty values passed', async () => {
      await expect(adapter.addToSet(uuid(), [])).rejects.toThrowError('wrong number of arguments for \'sadd\' command');
    });

    it('does not fail if set does not exist', async () => {
      await expect(adapter.addToSet(uuid(), [uuid()])).resolves.toBeUndefined();
    });
  });

  describe('deleteFromSet', () => {
    it('deletes value from set', async () => {
      const key = uuid();
      const value = uuid();

      await redis.sadd(`${CACHE_PREFIX}:${key}`, value);

      await adapter.deleteFromSet(key, [value]);

      await expect(redis.smembers(`${CACHE_PREFIX}:${key}`)).resolves.toEqual([]);
    });

    it('fails if empty values passed', async () => {
      const key = uuid();
      const value = uuid();

      await redis.sadd(`${CACHE_PREFIX}:${key}`, value);

      await expect(adapter.deleteFromSet(key, [])).rejects.toThrowError('wrong number of arguments for \'srem\' command');
    });

    it('does not fail if set does not exist', async () => {
      await expect(adapter.deleteFromSet(uuid(), [uuid()])).resolves.toBeUndefined();
    });
  });

  describe('intersectWithSet', () => {
    it('fails if empty values passed', async () => {
      await expect(adapter.intersectWithSet(uuid(), [])).rejects.toThrowError('wrong number of arguments for \'sadd\' command');
    });

    it('does not fail if set does not exist', async () => {
      await expect(adapter.intersectWithSet(uuid(), [uuid()])).resolves.toEqual(new Set());
    });

    it('returns original set if it does not intersect with passed one', async () => {
      const key = uuid();
      const value = uuid();

      await redis.sadd(`${CACHE_PREFIX}:${key}`, value);

      await expect(adapter.intersectWithSet(key, [uuid()])).resolves.toEqual(new Set());
    });

    it('returns non-empty intersection', async () => {
      const key = uuid();
      const value = uuid();

      await redis.sadd(`${CACHE_PREFIX}:${key}`, value);
      await redis.sadd(`${CACHE_PREFIX}:${uuid()}`, uuid());

      await expect(adapter.intersectWithSet(key, [value, uuid()])).resolves.toEqual(new Set([value]));
    });
  });
});
