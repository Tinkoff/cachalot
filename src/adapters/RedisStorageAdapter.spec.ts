import { EventEmitter } from "events";
import { DEFAULT_LOCK_EXPIRES, RedisStorageAdapter } from "./RedisStorageAdapter";
import { ConnectionStatus } from "../ConnectionStatus";

class RedisMock extends EventEmitter {}

let mock: any = new RedisMock();
let adapter: RedisStorageAdapter = new RedisStorageAdapter(mock as any);

describe("Redis adapter", () => {
  beforeEach(() => {
    mock = new RedisMock();
    adapter = new RedisStorageAdapter(mock as any);
  });

  it('Sets connection status to "connected" if redis emits ready', () => {
    mock.emit("ready");
    expect((adapter as any).connectionStatus).toEqual(ConnectionStatus.CONNECTED);
  });

  it('Sets connection status to "connecting" if redis emits reconnecting', () => {
    mock.emit("reconnecting");
    expect((adapter as any).connectionStatus).toEqual(ConnectionStatus.CONNECTING);
  });

  it('Sets connection status to "diconnected" if redis emits end', () => {
    mock.emit("end");
    expect((adapter as any).connectionStatus).toEqual(ConnectionStatus.DISCONNECTED);
  });

  it("connection status is disconnected by default", () => {
    expect((adapter as any).getConnectionStatus()).toEqual(ConnectionStatus.DISCONNECTED);
  });

  it("getConnectionStatus returns current connection status", () => {
    (adapter as any).connectionStatus = ConnectionStatus.CONNECTING;

    expect(adapter.getConnectionStatus()).toEqual(ConnectionStatus.CONNECTING);
  });

  it("onConnect calls callback function if redis instance emits ready", () => {
    const cb = jest.fn();

    adapter.onConnect(cb);
    mock.emit("ready");

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("set returns true if operation is successful", async () => {
    mock.set = jest.fn().mockImplementation(() => 1);

    expect(await adapter.set("some", "value")).toEqual(true);
  });

  it("set returns false if operation is not successful", async () => {
    mock.set = jest.fn().mockImplementation(() => 0);

    expect(await adapter.set("some", "value")).toEqual(false);
  });

  it("set calls set with cache prefix", async () => {
    mock.set = jest.fn().mockImplementation(() => 1);

    expect(await adapter.set("some", "value")).toEqual(true);
    expect(mock.set).toHaveBeenCalledTimes(1);
    expect(mock.set).toHaveBeenCalledWith("some", "value");
  });

  it("set calls set with cache prefix and PX mode when expires set", async () => {
    mock.set = jest.fn().mockImplementation(() => 1);

    expect(await adapter.set("some", "value", 1)).toEqual(true);
    expect(mock.set).toHaveBeenCalledTimes(1);
    expect(mock.set).toHaveBeenCalledWith("some", "value", "PX", 1);
  });

  it("get calls get with cache prefix", async () => {
    mock.get = jest.fn().mockImplementation(() => "hello");

    const value = await adapter.get("some");

    expect(value).toEqual("hello");
    expect(mock.get).toHaveBeenCalledTimes(1);
    expect(mock.get).toHaveBeenCalledWith("some");
  });

  it("del calls del with cache prefix", async () => {
    mock.del = jest.fn();

    await adapter.del("some");

    expect(mock.del).toHaveBeenCalledTimes(1);
    expect(mock.del).toHaveBeenCalledWith("some");
  });

  it("acquireLock returns true if lock is successful", async () => {
    mock.set = jest.fn().mockImplementation(() => "OK");

    const lockResult = await adapter.acquireLock("some");

    expect(lockResult).toEqual(true);
  });

  it("acquireLock returns false if lock is unsuccessful", async () => {
    mock.set = jest.fn().mockImplementation(() => null);

    const lockResult = await adapter.acquireLock("some");

    expect(lockResult).toEqual(false);
  });

  it("acquireLock calls set with generated key name and in NX mode", async () => {
    mock.set = jest.fn().mockImplementation(() => "OK");

    const lockResult = await adapter.acquireLock("some");

    expect(lockResult).toEqual(true);
    expect(mock.set).toBeCalledTimes(1);
    expect(mock.set).toBeCalledWith("some_lock", "", "PX", DEFAULT_LOCK_EXPIRES, "NX");
  });

  it("acquireLock use passed lockExpireTimeout", async () => {
    mock.set = jest.fn().mockImplementation(() => "OK");

    const lockExpireTimeout = 12345;
    const lockResult = await adapter.acquireLock("some", lockExpireTimeout);

    expect(lockResult).toEqual(true);
    expect(mock.set).toBeCalledTimes(1);
    expect(mock.set).toBeCalledWith("some_lock", "", "PX", lockExpireTimeout, "NX");
  });

  it("releaseLock delete lock record with appropriate key, and returns true on success", async () => {
    mock.del = jest.fn().mockImplementation(() => 1);

    const releaseLockResult = await adapter.releaseLock("some");
    expect(releaseLockResult).toEqual(true);
    expect(mock.del).toBeCalledTimes(1);
    expect(mock.del).toBeCalledWith("some_lock");
  });

  it("releaseLock delete lock record with appropriate key, and returns false on fail", async () => {
    mock.del = jest.fn().mockImplementation(() => 0);

    const releaseLockResult = await adapter.releaseLock("some");
    expect(releaseLockResult).toEqual(false);
    expect(mock.del).toBeCalledTimes(1);
    expect(mock.del).toBeCalledWith("some_lock");
  });

  it("isLockExists calls redis exists and return true if lock exists", async () => {
    mock.exists = jest.fn().mockImplementation(() => 1);

    const lockExists = await adapter.isLockExists("some");
    expect(lockExists).toEqual(true);
    expect(mock.exists).toBeCalledTimes(1);
    expect(mock.exists).toBeCalledWith("some_lock");
  });

  it("setConnectionStatus sets connection status to given string", () => {
    (adapter as any).setConnectionStatus(ConnectionStatus.CONNECTED);
    expect((adapter as any).connectionStatus).toEqual(ConnectionStatus.CONNECTED);
  });

  it("createRedisAdapter creates RedisStorageAdapter instance", () => {
    const instance = new RedisStorageAdapter(mock as any);

    expect(instance).toBeInstanceOf(RedisStorageAdapter);
  });

  it("mset sets values", async () => {
    mock.mset = jest.fn().mockImplementation();
    const values = new Map([
      ["some1", "value1"],
      ["some2", "value2"],
    ]);
    await adapter.mset(values);

    expect(mock.mset).toHaveBeenCalledTimes(1);
    expect(mock.mset).toHaveBeenCalledWith(
      new Map([
        ["some1", "value1"],
        ["some2", "value2"],
      ])
    );
  });

  it("mget gets values", async () => {
    const values = new Map([
      ["some1", "value1"],
      ["some2", "value2"],
    ]);
    mock.mget = jest.fn().mockImplementation(() => Array.from(values.values()));
    await adapter.mget(Array.from(values.keys()));

    expect(mock.mget).toHaveBeenCalledTimes(1);
    expect(mock.mget).toHaveBeenCalledWith("some1", "some2");
  });
});
