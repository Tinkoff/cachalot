import { ConnectionStatus } from "../../src/ConnectionStatus";
import { v4 as uuid } from "uuid";
import { StorageAdapter } from "../../src";

export interface Getter<K = string> {
  (key: K): Promise<string | null>;
}
export interface Setter<K = string> {
  (key: K, value: string): Promise<unknown>;
}

function delay(duration: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, duration + 1));
}

export const runAdapterTests = (get: Getter, set: Setter, adapter: StorageAdapter): void => {
  it('Sets connection status to "connected" if adapter executes some command', async () => {
    await adapter.get("test");
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
      await expect(get(key)).resolves.toEqual(value);
    });

    it("set calls set with cache prefix and expires when expires set", async () => {
      const key = uuid();
      const value = uuid();

      await adapter.set(key, value, 1000);
      await delay(2000);
      await expect(get(key)).resolves.toBeNull();
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

      await set(key, value);
      await expect(adapter.get(key)).resolves.toEqual(value);
    });
  });

  describe("del", () => {
    it("del calls del with cache prefix", async () => {
      const key = uuid();
      const value = uuid();

      await set(key, value);
      await adapter.del(key);
      await expect(get(key)).resolves.toBeNull();
    });

    it("del does nothing if key does not exist", async () => {
      const key = uuid();
      const keyWithPrefix = key;

      await expect(get(keyWithPrefix)).resolves.toBeNull();
      await adapter.del(key);
      await expect(get(keyWithPrefix)).resolves.toBeNull();
    });
  });

  describe("acquireLock", () => {
    it("acquireLock returns true if lock is successful", async () => {
      const key = uuid();
      const lockResult = await adapter.acquireLock(key);

      expect(lockResult).toEqual(true);
    });

    it("acquireLock calls set with generated key name", async () => {
      const key = uuid();
      const lockResult = await adapter.acquireLock(key, 1000);

      expect(lockResult).toEqual(true);

      await delay(2000);
      await expect(get(`${key}_lock`)).resolves.toBeNull();
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

      await set(`${key}_lock`, "");

      await delay(50);

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
        await expect(get(key)).resolves.toEqual(value);
      }
    });

    it("mset throws error on empty values", async () => {
      await expect(adapter.mset(new Map<string, string>())).rejects.toThrowError(
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
        await set(key, value);
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
        await set(key, value);
      }

      const keys = Array.from(values.keys());
      const nonExistingKey = uuid();

      keys.push(nonExistingKey);

      const result = await adapter.mget(keys);

      expect(result).toEqual([...Array.from(values.values()), null]);
    });
  });
};
