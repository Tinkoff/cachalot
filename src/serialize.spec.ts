import serialize from "./serialize";

describe("serialize", () => {
  it("stringifies number", () => {
    expect(serialize(1)).toEqual("1");
  });

  it("stringifies string", () => {
    expect(serialize("test")).toEqual('"test"');
  });

  it("stringifies object", () => {
    expect(serialize({ a: 2 })).toEqual('{"a":2}');
  });

  it("stringifies undefined", () => {
    expect(serialize(undefined)).toEqual(undefined);
  });

  it("stringifies null", () => {
    expect(serialize(null)).toEqual("null");
  });

  it("stringifies infinity to null", () => {
    expect(serialize(Infinity)).toEqual("null");
  });

  it("stringifies NaN to null", () => {
    expect(serialize(NaN)).toEqual("null");
  });
});
