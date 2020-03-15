import Cache from "./Cache";
import TestStorage from "./storage/__mocks__/TestStorage";
import TestStorageAdapter from "./adapters/TestStorageAdapter";
import { BaseStorage } from "./storage/BaseStorage";
import { EXPIRES_IN } from "./constants";
import RefreshAheadManager from "./managers/RefreshAheadManager";
import { ConnectionStatus } from "./ConnectionStatus";

const logger = {
  info: jest.fn(),
  trace: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockManager = class {
  static getName: any = () => "mock";
  get: any = jest.fn().mockResolvedValue("mockResult");
  set: any = jest.fn();
};

let instance: any;

jest.mock("./storage/BaseStorage");
jest.mock("./managers/RefreshAheadManager");

describe("Cache", () => {
  beforeEach(() => {
    instance = new Cache({
      adapter: new TestStorageAdapter({}, true),
      logger,
    });
  });

  it("uses provided storage instead of BaseStorage", () => {
    const customStorage = new TestStorage({
      adapter: new TestStorageAdapter({}, true),
    });
    instance = new Cache({
      storage: customStorage,
      logger,
    });

    expect(instance.storage).toEqual(customStorage);
  });

  it("creates BaseStorage if custom storage not provided", () => {
    expect(instance.storage).toBeInstanceOf(BaseStorage);
  });

  it("throws if nor BaseStorage nor custom storage was created", () => {
    expect(() => new Cache({ logger } as any)).toThrow();
  });

  it("throws if Logger was not passed in as dependency", () => {
    expect(
      () =>
        new Cache({
          adapter: new TestStorageAdapter({}, true),
        } as any)
    ).toThrow();
  });

  it("default key expiration is one day", () => {
    expect(instance.expiresIn).toEqual(EXPIRES_IN.day);
  });

  it("gets key expiration from options", () => {
    instance = new Cache({
      adapter: new TestStorageAdapter({}, true),
      logger,
      expiresIn: EXPIRES_IN.hour,
    });
    expect(instance.expiresIn).toEqual(EXPIRES_IN.hour);
  });

  it("registers RefreshAheadManager", () => {
    expect(instance.managers.get("refresh-ahead")).toBeInstanceOf(RefreshAheadManager);
  });

  it("registerManager registers new manager", () => {
    instance.registerManager(mockManager);
    expect(instance.managers.get("mock")).toBeInstanceOf(mockManager);
  });

  it("getManager throws if cannot get manager", () => {
    expect(() => instance.getManager("unknown")).toThrow();
  });

  it("getManager returns registered manager by its name", () => {
    instance.registerManager(mockManager, "custom-name");
    expect(instance.getManager("custom-name")).toBeInstanceOf(mockManager);
  });

  it('get calls executor directly if storage connection status is not "connected"', async () => {
    const customStorage = new TestStorage({
      adapter: new TestStorageAdapter({}, false),
    });

    customStorage.getConnectionStatus.mockReturnValue(ConnectionStatus.DISCONNECTED);

    const executor = jest.fn().mockResolvedValue(1);

    instance = new Cache({
      storage: customStorage,
      logger,
    });

    await expect(instance.get("test", executor)).resolves.toEqual(1);
  });

  it("get gets manager from options", async () => {
    const executor = jest.fn().mockResolvedValue(1);

    instance.registerManager(mockManager);

    await expect(instance.get("test", executor, { manager: "mock" })).resolves.toEqual("mockResult");
  });

  it("get defaults manager to RefreshAhead", async () => {
    const executor = jest.fn();
    const manager = instance.getManager("refresh-ahead");

    manager.get.mockResolvedValueOnce(1);

    await expect(instance.get("test", executor)).resolves.toEqual(1);
  });

  it("get delegates get to manager's get", async () => {
    instance.registerManager(mockManager);

    const executor = jest.fn().mockResolvedValue(1);
    const manager = instance.getManager("mock");

    manager.get.mockResolvedValueOnce("delegated call");

    await expect(instance.get("test", executor, { manager: "mock" })).resolves.toEqual("delegated call");
  });

  it("set gets manager from options", async () => {
    instance.registerManager(mockManager);

    const manager = instance.getManager("mock");

    await instance.set("test", "value", { manager: "mock" });
    await expect(manager.set).toBeCalled();
  });

  it("set defaults manager to RefreshAhead", async () => {
    const manager = instance.getManager("refresh-ahead");

    await instance.set("test", "value");
    await expect(manager.set).toBeCalled();
  });

  it("touch delegates touch of tags to storage directly", async () => {
    await instance.touch(["test", "value"]);
    await expect(instance.storage.touch).toBeCalled();
  });
});
