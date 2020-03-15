import timeout from "./timeout";

jest.useFakeTimers();

describe("timeout", () => {
  it("resolves after given time in ms", async () => {
    const TEST_TIMEOUT = 2000;

    timeout(TEST_TIMEOUT);

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), TEST_TIMEOUT);
  });
});
