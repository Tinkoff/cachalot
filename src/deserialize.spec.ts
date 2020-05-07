import deserialize from "./deserialize";

describe("deserizalize", () => {
  it("parses valid json string or null", () => {
    expect(deserialize("null")).toEqual(null);
    expect(deserialize('"test"')).toEqual("test");
    expect(deserialize("1")).toEqual(1);
    expect(deserialize('{"a":1}')).toEqual({ a: 1 });
  });

  it("throws parse error on invalid json string", () => {
    expect(() => deserialize("test")).toThrowErrorMatchingSnapshot();
    expect(() => deserialize('{"a":')).toThrowErrorMatchingSnapshot();
  });
});
