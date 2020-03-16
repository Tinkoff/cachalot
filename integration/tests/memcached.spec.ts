import Memcached from "memcached";
import MemcachedStorageAdapter from "../../src/adapters/MemcachedStorageAdapter";
import { Getter, runAdapterTests } from "./adapter-agnostic";

const memcached = new Memcached("127.0.0.1:11211");
const adapter = new MemcachedStorageAdapter(memcached);

const get: Getter<string> = (key: string) =>
  new Promise((resolve, reject) => {
    memcached.get(key, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (data === undefined) {
        return resolve(null);
      }

      resolve(data);
    });
  });

const set = (key: string, value: string) =>
  new Promise((resolve, reject) => {
    memcached.set(key, value, 0, (err, data) => {
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

  runAdapterTests(get, set, adapter);
});
