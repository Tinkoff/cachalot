import timeout from "./timeout";

describe("timeout", () => {
  it("resolves after given time in ms", () => {
    const TEST_TIMEOUT = 2000;
    const originalTimeout = setTimeout;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore useFakeTimers broken in jest 27

    setTimeout = jest.fn();
    timeout(TEST_TIMEOUT);

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), TEST_TIMEOUT);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore useFakeTimers broken in jest 27
    setTimeout = originalTimeout;
  });
});
