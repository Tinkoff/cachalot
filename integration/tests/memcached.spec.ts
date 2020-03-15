import Memcached from "memcached";
import MemcachedStorageAdapter from "../../src/adapters/MemcachedStorageAdapter";

const memcached = new Memcached("127.0.0.1:11211");
const adapter = new MemcachedStorageAdapter(memcached);

const get = (key: string) =>
  new Promise((resolve, reject) => {
    memcached.get(`cache:${key}`, (err, data) => {
      if (err) {
        return reject(err);
      }

      resolve(data);
    });
  });

describe("Memcached adapter", () => {
  beforeEach(async () => {
    await new Promise((resolve, reject) => {
      memcached.flush((err, results) => {
        if (err) {
          return reject(err);
        }

        resolve(results);
      });
    });
  });

  it("set", async () => {
    await adapter.set("skey1", "sval1");
    const actual = await get("skey1");

    expect(actual).toMatchInlineSnapshot(`"sval1"`);
  });

  it("get", async () => {
    await adapter.set("gkey1", "gval1");
    const actual = await adapter.get("gkey1");

    expect(actual).toMatchInlineSnapshot(`"gval1"`);
  });

  it("mset", async () => {
    await adapter.mset(
      new Map<string, string>([
        ["mkey1", "mval1"],
        ["mkey2", "mval2"],
      ])
    );
    const results = await Promise.all([get("mkey1"), get("mkey2")]);

    expect(results).toMatchInlineSnapshot(`
Array [
  "mval1",
  "mval2",
]
`);
  });

  it("mget", async () => {
    await adapter.mset(
      new Map<string, string>([
        ["mgkey1", "mgval1"],
        ["mgkey2", "mgval2"],
      ])
    );
    const results = await adapter.mget(["mgkey1", "mgkey2"]);

    expect(results).toMatchInlineSnapshot(`
Array [
  "mgval1",
  "mgval2",
]
`);
  });
});
