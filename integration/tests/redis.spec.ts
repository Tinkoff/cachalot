import { v4 as uuid } from "uuid";
import Redis, { Redis as RedisType } from "ioredis";
import RedisStorageAdapter, { CACHE_PREFIX } from "../../src/adapters/RedisStorageAdapter";
import { ConnectionStatus } from "../../src/ConnectionStatus";

let redis: RedisType;
let adapter: RedisStorageAdapter;

function delay(duration: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, duration + 1));
}

const longExpireTimeout = 50;
const shortExpireTimeout = 50;

describe("Redis adapter", () => {
  beforeAll(() => {
    redis = new Redis();
    adapter = new RedisStorageAdapter(redis, { lockExpireTimeout: longExpireTimeout });
  });

  afterAll(() => {
    redis.disconnect();
  });

  it('Sets connection status to "connected" if redis executes some command', async () => {
    await redis.get("");
    expect(adapter.getConnectionStatus()).toEqual(ConnectionStatus.CONNECTED);
  });

  describe("set", () => {
    it("set returns true if operation is successful", async () => {
      const key = uuid();
      const value = uuid();

      await expect(adapter.set(key, value)).resolves.toEqual(true);
      await expect(adapter.get(key)).resolves.toEqual(value);
    });

    it("set adds cache prefix", async () => {
      const key = uuid();
      const value = uuid();

      await adapter.set(key, value);
      await expect(redis.get(`${CACHE_PREFIX}:${key}`)).resolves.toEqual(value);
    });

    it("set calls set with cache prefix and PX mode when expires set", async () => {
      const key = uuid();
      const value = uuid();

      const localAdapter = new RedisStorageAdapter(redis, { lockExpireTimeout: shortExpireTimeout });

      await localAdapter.set(key, value, shortExpireTimeout);
      await delay(shortExpireTimeout);
      await expect(redis.get(`${CACHE_PREFIX}:${key}`)).resolves.toBeNull();
    });
  });

  describe("get", () => {
    it("get returns value", async () => {
      const key = uuid();
      const value = uuid();

      await expect(adapter.set(key, value));
      await expect(adapter.get(key)).resolves.toEqual(value);
    });

    it("get returns null if key does not set", async () => {
      const key = uuid();

      await expect(adapter.get(key)).resolves.toBeNull();
    });

    it("get adds cache prefix", async () => {
      const key = uuid();
      const value = uuid();

      await redis.set(`${CACHE_PREFIX}:${key}`, value);
      await expect(adapter.get(key)).resolves.toEqual(value);
    });
  });

  describe("del", () => {
    it("del calls del with cache prefix", async () => {
      const key = uuid();
      const value = uuid();

      await redis.set(`${CACHE_PREFIX}:${key}`, value);
      await adapter.del(key);
      await expect(redis.get(`${CACHE_PREFIX}:${key}`)).resolves.toBeNull();
    });

    it("del does nothing if key does not exist", async () => {
      const key = uuid();
      const keyWithPrefix = `${CACHE_PREFIX}:${key}`;

      await expect(redis.get(keyWithPrefix)).resolves.toBeNull();
      await adapter.del(key);
      await expect(redis.get(keyWithPrefix)).resolves.toBeNull();
    });
  });

  describe("acquireLock", () => {
    it("acquireLock returns true if lock is successful", async () => {
      const key = uuid();
      const lockResult = await adapter.acquireLock(key);

      expect(lockResult).toEqual(true);
    });

    it("acquireLock calls set with generated key name and in NX mode", async () => {
      const key = uuid();
      const localAdapter = new RedisStorageAdapter(redis, { lockExpireTimeout: shortExpireTimeout });
      const lockResult = await localAdapter.acquireLock(key);

      expect(lockResult).toEqual(true);

      await delay(shortExpireTimeout);
      await expect(redis.get(`cache:${key}_lock`)).resolves.toBeNull();
    });
  });

  describe("releaseLock", () => {
    it("releaseLock returns false if lock does not exist", async () => {
      const key = uuid();
      const releaseLockResult = await adapter.releaseLock(key);

      expect(releaseLockResult).toEqual(false);
    });

    it("releaseLock delete lock record with appropriate key, and returns true on success", async () => {
      const key = uuid();

      await redis.set(`cache:${key}_lock`, "");

      await delay(shortExpireTimeout);

      const releaseLockResult = await adapter.releaseLock(key);

      expect(releaseLockResult).toEqual(true);
    });

    it("releaseLock delete lock record set by acquireLock", async () => {
      const key = uuid();

      await adapter.acquireLock(key);
      await expect(adapter.releaseLock(key)).resolves.toEqual(true);
    });
  });

  describe("isLockExists", () => {
    it("isLockExists returns true if lock exists", async () => {
      const key = uuid();

      await adapter.acquireLock(key);
      await expect(adapter.isLockExists(key)).resolves.toEqual(true);
    });

    it("isLockExists returns false if lock does not exist", async () => {
      const key = uuid();

      await expect(adapter.isLockExists(key)).resolves.toEqual(false);
    });
  });

  describe("mset", () => {
    it("mset sets values", async () => {
      const values = new Map([
        [uuid(), uuid()],
        [uuid(), uuid()],
      ]);

      await adapter.mset(values);

      for (const [key, value] of values.entries()) {
        await expect(redis.get(`${CACHE_PREFIX}:${key}`)).resolves.toEqual(value);
      }
    });

    it("mset throws error on empty values", async () => {
      await expect(adapter.mset(new Map<string, any>())).rejects.toThrowError(
        "ERR wrong number of arguments for 'mset' command"
      );
    });
  });

  describe("mget", () => {
    it("mget gets values", async () => {
      const values = new Map([
        [uuid(), uuid()],
        [uuid(), uuid()],
      ]);

      for (const [key, value] of values.entries()) {
        await redis.set(`${CACHE_PREFIX}:${key}`, value);
      }

      const result = await adapter.mget(Array.from(values.keys()));

      expect(result).toEqual(Array.from(values.values()));
    });

    it("mget returns null for non-existing keys", async () => {
      const values = new Map([
        [uuid(), uuid()],
        [uuid(), uuid()],
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
  });
});
