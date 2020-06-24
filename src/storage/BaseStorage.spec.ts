import TestStorageAdapter from "../adapters/TestStorageAdapter";
import { ConnectionStatus } from "../ConnectionStatus";
import { operationTimeoutError } from "../errors/errors";
import timeout from "../timeout";
import { BaseStorage, TAGS_VERSIONS_ALIAS } from "./BaseStorage";
import { Record } from "./Record";

interface TestStorage {
  [key: string]: string;
}

let testStorage: TestStorage;
let testAdapter: TestStorageAdapter;
let storage: BaseStorage;

describe("BaseStorage", () => {
  beforeEach(() => {
    testStorage = {};
    testAdapter = new TestStorageAdapter(testStorage, true);
    storage = new BaseStorage({
      adapter: testAdapter,
      prefix: "cache",
      hashKeys: false,
      expiresIn: 10000,
    });
  });

  it("set creates record without value and tags if value === undefined", async () => {
    await storage.set("test", undefined, { tags: ["tag"] });

    const value = JSON.parse(testStorage["cache-test"]);

    expect(value).toMatchObject({
      key: "test",
      permanent: true,
    });
    expect(value.tags).toHaveLength(0);
  });

  it("default prefix is empty string", async () => {
    storage = new BaseStorage({
      adapter: testAdapter,
      hashKeys: false,
      expiresIn: 10000,
    });

    await storage.set("test", "123");

    expect((testStorage as any).test).toEqual(expect.any(String));
  });

  it("creates hashed by md5 keys if hashKeys set to true", async () => {
    storage = new BaseStorage({
      adapter: testAdapter,
      hashKeys: true,
      expiresIn: 10000,
    });

    await storage.set("test", "123");

    expect(testStorage as any).toMatchObject({
      "098f6bcd4621d373cade4e832627b4f6": expect.any(String),
    });
  });

  it("setOptions sets options to adapter", () => {
    const options = {
      adapter: testAdapter,
      prefix: "cache",
      hashKeys: false,
      expiresIn: 10000,
    };

    testAdapter.setOptions = jest.fn();
    storage = new BaseStorage(options);
    expect(testAdapter.setOptions).toBeCalledWith(options);
  });

  it("set sets key to storage adapter", async () => {
    await storage.set("test", "123");

    const value = JSON.parse(testStorage["cache-test"]);

    expect(value).toMatchObject({
      key: "test",
      permanent: true,
      value: '"123"',
    });
    expect(value.tags).toEqual([]);
    expect(value.expiresIn).toEqual(expect.any(Number));
  });

  it("set sets key to storage adapter with dynamic tags", async () => {
    await storage.set("test", "123", { getTags: result => [result] });

    const value = JSON.parse(testStorage["cache-test"]);

    expect(value).toMatchObject({
      key: "test",
      permanent: true,
      value: '"123"',
    });
    expect(value.tags).toMatchObject([{ name: "123" }]);
    expect(value.expiresIn).toEqual(expect.any(Number));
  });

  it("set sets key to storage adapter with uniq array of concatenated dynamic tags and simple tags", async () => {
    await storage.set("test", "123", { tags: ["tag1", "123"], getTags: result => [result] });

    const value = JSON.parse(testStorage["cache-test"]);

    expect(value).toMatchObject({
      key: "test",
      permanent: true,
      value: '"123"',
    });
    expect(value.tags).toMatchObject([{ name: "tag1" }, { name: "123" }]);
    expect(value.expiresIn).toEqual(expect.any(Number));
  });

  it("set throws if dynamic tags Fn returns non-array value", async () => {
    await expect(storage.set("test", "123", { getTags: () => false } as any)).rejects.toThrow();
  });

  it("set sets object key to storage adapter with dynamic tags", async () => {
    await storage.set("test", { id: "uuid" }, { getTags: ({ id }) => [id] });

    const value = JSON.parse(testStorage["cache-test"]);

    expect(value).toMatchObject({
      key: "test",
      permanent: true,
      value: '{"id":"uuid"}',
    });
    expect(value.tags).toMatchObject([{ name: "uuid" }]);
    expect(value.expiresIn).toEqual(expect.any(Number));
  });

  it("set sets key to storage adapter with given options", async () => {
    await storage.set("test", "123", { expiresIn: 0 });

    const value = JSON.parse(testStorage["cache-test"]);

    expect(value).toMatchObject({
      key: "test",
      permanent: true,
      value: '"123"',
    });
    expect(value.tags).toEqual([]);
    expect(value.expiresIn).toEqual(expect.any(Number));
  });

  it("get returns value from adapter", async () => {
    await storage.set("test", "123", { expiresIn: 0 });
    expect(await storage.get("test")).toEqual({
      createdAt: expect.any(Number),
      expiresIn: 0,
      key: "test",
      permanent: true,
      tags: [],
      value: '"123"',
    });
  });

  it("touch updates cache tags", async () => {
    await storage.set("test", "123", { expiresIn: 0, tags: ["sometag"] });

    const TIMEOUT = 10;
    const tagsBefore = testStorage["cache-cache-tags-versions:sometag"];

    await timeout(TIMEOUT);
    await storage.touch(["sometag"]);

    expect(testStorage["cache-cache-tags-versions:sometag"]).not.toEqual(tagsBefore);
  });

  it("touch does nothing if tag list is empty", async () => {
    await storage.set("test", "123", { expiresIn: 0, tags: ["sometag"] });

    const TIMEOUT = 10;
    const tagsBefore = testStorage["cache-cache-tags-versions:sometag"];

    await timeout(TIMEOUT);
    await storage.touch([]);

    expect(testStorage["cache-cache-tags-versions:sometag"]).toEqual(tagsBefore);
  });

  it("getLockedKeyRetrieveStrategy throws if cannot get strategy", () => {
    expect(() => (storage as any).getLockedKeyRetrieveStrategy("unknown")).toThrow();
  });

  it("get returns result if value exists in storage", async () => {
    await storage.set("test", "123", { expiresIn: 100 });

    expect(await storage.get("test")).toMatchObject({ value: '"123"' });
  });

  it("get returns null if value not exists in storage", async () => {
    expect(await storage.get("test")).toBeNull();
  });

  it("get throws if storage returns invalid record", async () => {
    (testStorage as any)["cache-test"] = `{"a":1}`;

    expect(await storage.get("test")).toBeNull();
  });

  it("del deletes key from storage", async () => {
    await storage.set("test", "123", { expiresIn: 500 });
    await storage.set("test1", "1234", { expiresIn: 500 });
    await storage.set("test2", "1234", { expiresIn: 500 });

    expect(await storage.get("test")).toMatchObject({ value: '"123"' });
    await storage.del("test");
    await expect(storage.get("test")).resolves.toBeNull();
  });

  it("getTags returns actual tag versions", async () => {
    const tag1 = { name: "tag1", version: 1537176259547 };
    const tag2 = { name: "tag2", version: 1537176259572 };
    const tag3 = { name: "tag3", version: 1537176259922 };

    testStorage[`cache-${TAGS_VERSIONS_ALIAS}:${tag1.name}`] = tag1.version.toString();
    testStorage[`cache-${TAGS_VERSIONS_ALIAS}:${tag2.name}`] = tag2.version.toString();
    testStorage[`cache-${TAGS_VERSIONS_ALIAS}:${tag3.name}`] = tag3.version.toString();

    expect(await storage.getTags(["tag2", "tag3"])).toEqual([tag2, tag3]);
    expect(await storage.getTags(["tag1", "tag3"])).toEqual([tag1, tag3]);
    expect(await storage.getTags(["tag3", "tag2"])).toEqual([tag3, tag2]);
  });

  it("getTags creates tag with zero version if it not exists", async () => {
    const tag1 = { name: "tag1", version: 1537176259547 };

    testStorage[`cache-${TAGS_VERSIONS_ALIAS}:${tag1.name}`] = tag1.version.toString();

    expect(await storage.getTags(["tag1", "tag3"])).toEqual([
      tag1,
      {
        name: "tag3",
        version: 0,
      },
    ]);
  });

  it("getTags does nothing if tag list is empty", async () => {
    const tag1 = { name: "tag1", version: 1537176259547 };

    testStorage[`cache-${TAGS_VERSIONS_ALIAS}:${tag1.name}`] = tag1.version.toString();

    expect(await (storage as any).getTags([])).toEqual([]);
  });

  it("lockKey returns true if lock exists", async () => {
    await storage.set("test", "123", { expiresIn: 0 });

    expect(await (storage as any).lockKey("test")).toEqual(true);
    expect(testStorage["cache-test_lock"]).toEqual("");
  });

  it("lockKey returns false if lock exists", async () => {
    await storage.set("test", "123", { expiresIn: 0 });

    testAdapter.acquireLock = async () => false;

    expect(await (storage as any).lockKey("test")).toEqual(false);
    expect(testStorage["cache-test_lock"]).toEqual(undefined);
  });

  it("releaseLock releases lock", async () => {
    (testStorage as any)["cache-test_lock"] = '{"key":"cache-test_lock"}';

    expect(await storage.get("test_lock")).toMatchObject({ key: "cache-test_lock" });
    await storage.releaseKey("test");
    expect(await storage.get("test_lock")).toBeNull();
  });

  it("keyIsLocked returns true if lock exists", async () => {
    (testStorage as any)["cache-test_lock"] = '{"key":"cache-test_lock"}';
    expect(await storage.keyIsLocked("test")).toEqual(true);
  });

  it("cachedCommand throws if function is undefined", async () => {
    await expect((storage as any).cachedCommand(undefined, 1, "hello")).rejects.toThrow();
  });

  it("getConnectionStatus returns current connection status", () => {
    expect(storage.getConnectionStatus()).toEqual(ConnectionStatus.CONNECTED);
  });

  it("cachedCommand pushes command to command queue if status is not CONNECTED", async () => {
    const command = jest.fn();
    testAdapter.getConnectionStatus = (): ConnectionStatus => ConnectionStatus.DISCONNECTED;

    await expect((storage as any).cachedCommand(command, 1, "hello")).resolves.toEqual(undefined);
    expect((storage as any).commandsQueue).toEqual([{ fn: command, params: [1, "hello"] }]);
  });

  it("cachedCommand pushes command to command queue if execution timed out", async () => {
    const error = operationTimeoutError(1);
    const command = jest.fn().mockRejectedValue(error);

    await expect((storage as any).cachedCommand(command, 1, "hello")).resolves.toEqual(undefined);
    expect((storage as any).commandsQueue).toEqual([{ fn: command, params: [1, "hello"] }]);
  });

  it("cachedCommand throws if command execution fails and not timed out", async () => {
    const error = new Error();
    const command = jest.fn().mockRejectedValue(error);

    await expect((storage as any).cachedCommand(command, 1, "hello")).rejects.toThrowError(error);
    expect((storage as any).commandsQueue.length).toEqual(0);
  });

  it("executeCommandsFromQueue does nothing if queue is empty", async () => {
    await expect((storage as any).executeCommandsFromQueue()).resolves.not.toThrow();
  });

  it("executeCommandsFromQueue executes commands and saves unsuccessfull commands to queue", async () => {
    const command1 = async (a: number): Promise<number> => a;
    const command2 = async (): Promise<void> => {
      throw new Error("error!");
    };
    const command3 = async (a: number, b: number): Promise<number> => a + b;
    (storage as any).commandsQueue = [
      {
        fn: command1,
        params: [1],
      },
      {
        fn: command2,
        params: [1, 1],
      },
      {
        fn: command3,
        params: [1, 1],
      },
    ];
    await expect((storage as any).executeCommandsFromQueue()).resolves.not.toThrow();
    expect((storage as any).commandsQueue).toEqual([
      {
        fn: command2,
        params: [1, 1],
      },
    ]);
  });

  it("set creates record with static tags calculated by function", async () => {
    await storage.set("test", "test", { tags: () => ["tag"] });

    const value = JSON.parse(testStorage["cache-test"]);

    expect(value).toMatchObject({
      key: "test",
      permanent: true,
      value: '"test"',
    });

    expect(value.tags).toMatchObject([{ name: "tag" }]);
    expect(value.expiresIn).toEqual(expect.any(Number));
  });

  it("uses separate adapter for tags", async () => {
    const tag1 = { name: "tag1", version: 1 };
    const tagsTestStorage: TestStorage = {};
    const tagsTestAdapter = new TestStorageAdapter(tagsTestStorage, true);
    tagsTestStorage[`cache-${TAGS_VERSIONS_ALIAS}:tag1`] = tag1.version.toString();
    storage = new BaseStorage({
      adapter: testAdapter,
      tagsAdapter: tagsTestAdapter,
      prefix: "cache",
      hashKeys: false,
      expiresIn: 10000,
    });

    const tags = await storage.getTags([tag1.name]);
    expect(tags).toEqual([tag1]);

    const tagV2 = { ...tag1, version: 2 };
    await storage.setTagVersions([tagV2]);
    await expect(storage.getTags([tag1.name])).resolves.toEqual([tagV2]);
  });

  it("isOutdated returns true if cannot get tags", async () => {
    storage.getTags = jest.fn().mockImplementationOnce(() => {
      throw new Error("Operation timeout");
    });

    const record = new Record("test", "value", [{ name: "tag1", version: 1 }]);
    await expect(storage.isOutdated(record)).resolves.toEqual(true);
  });

  it("isOutdated returns true if tags outdated", async () => {
    storage.getTags = jest.fn().mockResolvedValueOnce([
      {
        name: "tag1",
        version: 2,
      },
    ]);

    const record = new Record("test", "value", [{ name: "tag1", version: 1 }]);
    await expect(storage.isOutdated(record)).resolves.toEqual(true);
  });

  it("isOutdated returns false if tags not outdated", async () => {
    storage.getTags = jest.fn().mockResolvedValue([
      {
        name: "tag1",
        version: 2,
      },
    ]);

    const record = new Record("test", "value", [{ name: "tag1", version: 3 }]);
    await expect(storage.isOutdated(record)).resolves.toEqual(false);
    const record2 = new Record("test2", "value2", [{ name: "tag1", version: 2 }]);
    await expect(storage.isOutdated(record2)).resolves.toEqual(false);
  });

  it("isOutdated returns false no tags present in record", async () => {
    storage.getTags = jest.fn().mockResolvedValue([
      {
        name: "tag1",
        version: 2,
      },
    ]);

    const record = new Record("test", "value", []);
    await expect(storage.isOutdated(record)).resolves.toEqual(false);
  });
});
