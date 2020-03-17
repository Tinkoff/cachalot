import customError from "./custom-error";

describe("custom error", () => {
  it("creates custom error with given name", () => {
    const error = customError("Custom", "message", { test: 1 });

    expect(error).toHaveProperty("name", "Custom");
    expect(error).toHaveProperty("message", "message");
    expect(error).toHaveProperty("payload", { test: 1 });
    expect(error).toEqual(expect.any(Error));
  });

  it("error payload defaults to empty object", () => {
    const error = customError("Custom", "message");

    expect(error).toHaveProperty("payload", {});
  });
});
