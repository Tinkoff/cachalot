import { EventEmitter } from "events";
import { MemcachedStorageAdapter } from "./MemcachedStorageAdapter";
import { ConnectionStatus } from "../ConnectionStatus";

class MemcachedMock extends EventEmitter {}

let mock: any = new MemcachedMock();
let adapter: MemcachedStorageAdapter = new MemcachedStorageAdapter(mock);

describe("Memcached adapter", () => {
  beforeEach(() => {
    mock = new MemcachedMock();
    adapter = new MemcachedStorageAdapter(mock);
  });

  it('Sets connection status to "connected" if Memcached emits reconnect', () => {
    mock.emit("reconnect");
    expect((adapter as any).connectionStatus).toEqual(ConnectionStatus.CONNECTED);
  });

  it('Sets connection status to "connecting" if Memcached emits reconnecting', () => {
    mock.emit("reconnecting");
    expect((adapter as any).connectionStatus).toEqual(ConnectionStatus.CONNECTING);
  });

  it('Sets connection status to "diconnected" if Memcached emits failure', () => {
    mock.emit("failure");
    expect((adapter as any).connectionStatus).toEqual(ConnectionStatus.DISCONNECTED);
  });

  it("connection status is connected by default", () => {
    expect((adapter as any).getConnectionStatus()).toEqual(ConnectionStatus.CONNECTED);
  });

  it("getConnectionStatus returns current connection status", () => {
    (adapter as any).connectionStatus = ConnectionStatus.CONNECTING;

    expect(adapter.getConnectionStatus()).toEqual(ConnectionStatus.CONNECTING);
  });

  it("onConnect calls callback function if Memcached instance emits reconnect", () => {
    const cb = jest.fn();

    adapter.onConnect(cb);
    mock.emit("reconnect");

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("set returns true if operation is successful", async () => {
    mock.set = jest.fn().mockImplementation((key, value, lifetime, cb) => cb(null, true));

    expect(await adapter.set("some", "value")).toEqual(true);
  });

  it("set returns false if operation is not successful", async () => {
    mock.set = jest.fn().mockImplementation((key, value, lifetime, cb) => cb(null, false));

    expect(await adapter.set("some", "value")).toEqual(false);
  });

  it("set throws if operation throws", async () => {
    mock.set = jest.fn().mockImplementation((key, value, lifetime, cb) => cb(new Error("err"), false));

    await expect(adapter.set("some", "value")).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Operation \\"set\\" error. err"`
    );
  });

  it("set calls set with cache prefix", async () => {
    mock.set = jest.fn().mockImplementation((key, value, lifetime, cb) => cb(null, true));

    expect(await adapter.set("some", "value")).toEqual(true);
    expect(mock.set).toHaveBeenCalledTimes(1);
    expect(mock.set).toHaveBeenCalledWith("some", "value", 0, expect.any(Function));
  });

  it("set converts milliseconds to seconds", async () => {
    mock.set = jest.fn().mockImplementation((key, value, lifetime, cb) => cb(null, true));

    expect(await adapter.set("some", "value", 25000)).toEqual(true);
    expect(mock.set).toHaveBeenCalledTimes(1);
    expect(mock.set).toHaveBeenCalledWith("some", "value", 25, expect.any(Function));
  });

  it("get calls returns value", async () => {
    mock.get = jest.fn().mockImplementation((key, cb) => cb(null, "some"));

    const value = await adapter.get("some");

    expect(value).toEqual("some");
  });

  it("get returns null if no value in storage", async () => {
    mock.get = jest.fn().mockImplementation((key, cb) => cb(null, undefined));

    const value = await adapter.get("some");

    expect(value).toEqual(null);
  });

  it("get throws on operation error", async () => {
    mock.get = jest.fn().mockImplementation((key, cb) => cb(new Error("some"), null));

    await expect(adapter.get("some")).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Operation \\"get\\" error. some"`
    );
  });

  it("get throws on empty key", async () => {
    await expect(adapter.get("")).rejects.toThrowErrorMatchingInlineSnapshot(
      `"ERR wrong arguments for 'get' command"`
    );
  });

  it("del calls del with cache prefix", async () => {
    mock.del = jest.fn().mockImplementation((key, cb) => cb(null, true));

    await adapter.del("some");

    expect(mock.del).toHaveBeenCalledTimes(1);
    expect(mock.del).toHaveBeenCalledWith("some", expect.any(Function));
  });

  it("del throws if operation throws", async () => {
    mock.del = jest.fn().mockImplementation((key, cb) => cb(new Error("some"), true));

    await expect(adapter.del("some")).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Operation \\"del\\" error. some"`
    );
  });

  it("acquireLock returns true if lock is successful", async () => {
    mock.add = jest.fn().mockImplementation((key, value, expire, cb) => cb(null, true));

    const lockResult = await adapter.acquireLock("some");

    expect(lockResult).toEqual(true);
  });

  it("acquireLock returns false if lock is unsuccessful", async () => {
    mock.add = jest.fn().mockImplementation((key, value, expire, cb) => cb(null, false));

    const lockResult = await adapter.acquireLock("some");

    expect(lockResult).toEqual(false);
  });

  it("acquireLock throws if lock operation throws", async () => {
    mock.add = jest.fn().mockImplementation((key, value, expire, cb) => cb(new Error("some"), false));

    await expect(adapter.acquireLock("some")).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Operation \\"acquireLock\\" error. some"`
    );
  });

  it("acquireLock calls add with generated key name", async () => {
    mock.add = jest.fn().mockImplementation((key, value, expire, cb) => cb(null, true));

    const lockResult = await adapter.acquireLock("some");

    expect(lockResult).toEqual(true);
    expect(mock.add).toBeCalledTimes(1);
    expect(mock.add).toBeCalledWith("some_lock", "", 20, expect.any(Function));
  });

  it("acquireLock uses provided expire timeout instead of global one", async () => {
    mock.add = jest.fn().mockImplementation((key, value, expire, cb) => cb(null, true));

    const lockResult = await adapter.acquireLock("some", 10000);

    expect(lockResult).toEqual(true);
    expect(mock.add).toBeCalledTimes(1);
    expect(mock.add).toBeCalledWith("some_lock", "", 10, expect.any(Function));
  });

  it("releaseLock delete lock record with appropriate key, and returns true on success", async () => {
    mock.del = jest.fn().mockImplementation((key, cb) => cb(null, true));

    const releaseLockResult = await adapter.releaseLock("some");

    expect(releaseLockResult).toEqual(true);
    expect(mock.del).toBeCalledTimes(1);
    expect(mock.del).toBeCalledWith("some_lock", expect.any(Function));
  });

  it("releaseLock delete lock record with appropriate key, and returns false on fail", async () => {
    mock.del = jest.fn().mockImplementation((key, cb) => cb(null, false));

    const releaseLockResult = await adapter.releaseLock("some");

    expect(releaseLockResult).toEqual(false);
    expect(mock.del).toBeCalledTimes(1);
    expect(mock.del).toBeCalledWith("some_lock", expect.any(Function));
  });

  it("releaseLock delete lock record with appropriate key, throws on error", async () => {
    mock.del = jest.fn().mockImplementation((key, cb) => cb(new Error("some"), false));

    await expect(adapter.releaseLock("some")).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Operation \\"releaseLock\\" error. some"`
    );
  });

  it("isLockExists returns true if lock exists", async () => {
    mock.get = jest.fn().mockImplementation((key, cb) => cb(null, ""));

    await expect(adapter.isLockExists("some")).resolves.toEqual(true);
  });

  it("isLockExists returns false if lock not exists", async () => {
    mock.get = jest.fn().mockImplementation((key, cb) => cb(null, null));

    await expect(adapter.isLockExists("some")).resolves.toEqual(false);

    mock.get = jest.fn().mockImplementation((key, cb) => cb(null, undefined));

    await expect(adapter.isLockExists("some")).resolves.toEqual(false);
  });

  it("isLockExists throws if operation get throws", async () => {
    mock.get = jest.fn().mockImplementation((key, cb) => cb(new Error("some"), false));

    await expect(adapter.isLockExists("some")).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Operation \\"isLockExists\\" error. some"`
    );
  });

  it("setConnectionStatus sets connection status to given string", () => {
    (adapter as any).setConnectionStatus(ConnectionStatus.CONNECTED);
    expect((adapter as any).connectionStatus).toEqual(ConnectionStatus.CONNECTED);
  });

  it("mset sets values", async () => {
    mock.set = jest.fn().mockImplementation((key, value, lifetime, cb) => cb(null, true));

    const values = new Map([
      ["some1", "value1"],
      ["some2", "value2"],
    ]);
    await adapter.mset(values);

    expect(mock.set).toHaveBeenCalledTimes(2);
    expect(mock.set.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "some1",
          "value1",
          0,
          [Function],
        ],
        Array [
          "some2",
          "value2",
          0,
          [Function],
        ],
      ]
    `);
  });

  it("mset throws on empty Map", async () => {
    const values = new Map();
    await expect(adapter.mset(values)).rejects.toThrowErrorMatchingInlineSnapshot(
      `"ERR wrong number of arguments for 'mset' command"`
    );
  });

  it("mget gets values", async () => {
    const values = {
      some1: "value1",
      some2: "value2",
      some3: undefined,
    };

    mock.getMulti = jest.fn().mockImplementation((keys, cb) => cb(null, values));
    await expect(adapter.mget(Object.keys(values))).resolves.toMatchInlineSnapshot(`
Array [
  "value1",
  "value2",
  null,
]
`);

    expect(mock.getMulti).toHaveBeenCalledTimes(1);
    expect(mock.getMulti).toHaveBeenCalledWith(["some1", "some2", "some3"], expect.any(Function));
  });

  it("mget throws on error", async () => {
    mock.getMulti = jest.fn().mockImplementation((keys, cb) => cb(new Error("some"), null));
    await expect(adapter.mget([])).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Operation \\"mget\\" error. some"`
    );
  });
});
