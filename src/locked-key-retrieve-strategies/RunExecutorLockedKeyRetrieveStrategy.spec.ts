import { RunExecutorLockedKeyRetrieveStrategy } from "./RunExecutorLockedKeyRetrieveStrategy";

let instance;

describe("RunExecutorLockedKeyRetrieveStrategy", () => {
  beforeEach(() => {
    instance = new RunExecutorLockedKeyRetrieveStrategy();
  });

  it("getName returns string", () => {
    expect(instance.getName()).toEqual(expect.any(String));
  });

  it("get calls context executor", async () => {
    const executorMock = jest.fn().mockResolvedValue(true);

    await expect(instance.get({ executor: executorMock })).resolves.toEqual(true);
  });
});
