import {
  DEFAULT_MAXIMUM_TIMEOUT,
  DEFAULT_REQUEST_TIMEOUT,
  WaitForResultLockedKeyRetrieveStrategy,
} from "./WaitForResultLockedKeyRetrieveStrategy";

let instance;

const loggerMock: any = {
  error: jest.fn(),
};
const getRecordMock = jest.fn();
const keyLockCheckFnMock = jest.fn();

describe("WaitForResultLockedKeyRetrieveStrategy", () => {
  beforeEach(() => {
    instance = new WaitForResultLockedKeyRetrieveStrategy({
      logger: loggerMock,
      getRecord: getRecordMock,
      keyLockCheckFn: keyLockCheckFnMock,
      maximumTimeout: 100,
      requestTimeout: 10,
    });
  });

  it("sets default timeouts if other not provided", () => {
    instance = new WaitForResultLockedKeyRetrieveStrategy({
      logger: loggerMock,
      getRecord: getRecordMock,
      keyLockCheckFn: keyLockCheckFnMock,
    });

    expect(instance.maximumTimeout).toEqual(DEFAULT_MAXIMUM_TIMEOUT);
    expect(instance.requestTimeout).toEqual(DEFAULT_REQUEST_TIMEOUT);
  });

  it("getName returns string", () => {
    expect(instance.getName()).toEqual(expect.any(String));
  });

  it("get deserializes value", async () => {
    keyLockCheckFnMock.mockReturnValue(false);
    getRecordMock.mockReturnValue({ value: `{"a":1}` });

    expect(await instance.get({ key: "test" })).toEqual({ a: 1 });
    getRecordMock.mockReset();
  });

  it("get throws if null in cache", async () => {
    getRecordMock.mockReturnValue(null);
    await expect(instance.get({ key: "test" })).rejects.toThrow("Error while waiting for result in cache");
    getRecordMock.mockReset();
  });

  it("get throws if executor put no record in cache", async () => {
    await expect(instance.get({ key: "test" })).rejects.toThrow("Error while waiting for result in cache");
  });

  it("get throws if maximum timeout exceeded, while trying to access locked key", async () => {
    keyLockCheckFnMock.mockReturnValue(true);
    await expect(instance.get({ key: "test" })).rejects.toThrow("Exceeded maximum timeout of 100");
    keyLockCheckFnMock.mockReset();
  });

  it("get returns undefined if record value is undefined", async () => {
    keyLockCheckFnMock.mockReturnValue(false);
    getRecordMock.mockReturnValue({ value: undefined });

    expect(await instance.get({ key: "test" })).toEqual(undefined);
    getRecordMock.mockReset();
  });
});
