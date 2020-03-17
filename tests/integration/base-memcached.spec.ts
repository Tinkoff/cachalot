import Memcached from "memcached";
import { runStorageTests } from "./base-agnostic";
import MemcachedStorageAdapter from "../../src/adapters/MemcachedStorageAdapter";
import { BaseStorage } from "../../src/storage/BaseStorage";

const memcached = new Memcached("127.0.0.1:11211");
const adapter = new MemcachedStorageAdapter(memcached);
const prefix = "cache";
const storage = new BaseStorage({ adapter, prefix });

describe("Base storage - memcached", () => {
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

  runStorageTests(storage, adapter);
});
