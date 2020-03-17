import Redis from "ioredis";
import { v4 as uuid } from "uuid";
import Cache from "../../src/Cache";
import RedisStorageAdapter from "../../src/adapters/RedisStorageAdapter";
import timeout from "../../src/timeout";

const logger = {
  info: jest.fn(),
  trace: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const redis = new Redis({
  enableOfflineQueue: false,
  enableReadyCheck: true,
  autoResendUnfulfilledCommands: false,
});
const cache = new Cache({
  adapter: new RedisStorageAdapter(redis),
  logger,
});

describe("Cache", () => {
  beforeEach(
    () =>
      new Promise(resolve => {
        redis.connect().catch(() => {
          /* ignore */
        });

        if (redis.status === "ready") {
          redis.flushall();
          return resolve();
        }

        redis.on("ready", () => {
          resolve();
          redis.flushall();
        });
      })
  );

  afterAll(() => {
    redis.disconnect();
  });

  it("is able to set value and get it", async () => {
    const struct = { a: 1, b: 2 };
    const key = uuid();

    await cache.set(key, struct);
    await expect(cache.get(key, jest.fn)).resolves.toEqual(struct);
  });

  it("runs executor and saves it result to storage on miss", async () => {
    const struct = { a: 1, b: 2 };
    const key = uuid();

    await expect(cache.get(key, () => struct)).resolves.toEqual(struct);
    await timeout(100);
    await expect(cache.get(key, jest.fn)).resolves.toEqual(struct);
  });

  it("retrieves data from base storage if cache is down", async () => {
    const struct = { a: 1, b: 2 };
    const key = uuid();

    await cache.set(key, struct);
    redis.disconnect();
    await timeout(100);
    await expect(cache.get(key, async () => struct)).resolves.toEqual(struct);
  });

  it("throws if both base storage and cache is unavailable", async () => {
    const struct = { a: 1, b: 2 };
    const key = uuid();
    const executor = (): never => {
      throw new Error("connection timed out");
    };

    await cache.set(key, struct);
    redis.disconnect();
    await timeout(100);
    await expect(cache.get(key, executor)).rejects.toThrowErrorMatchingInlineSnapshot(
      `"connection timed out"`
    );
  });

  it("gets value from cache if tags valid", async () => {
    const struct = { a: 1, b: 2 };
    const tags = [uuid()];
    const key = uuid();

    await expect(cache.get(key, () => struct, { tags })).resolves.toEqual(struct);
    await timeout(100);
    await expect(cache.get(key, jest.fn, { tags })).resolves.toEqual(struct);
  });

  it("gets value from storage if tags not valid", async () => {
    const struct = { a: 1, b: 2 };
    const executor = () => struct;
    const tags = [uuid()];
    const key = uuid();

    await expect(cache.get(key, executor, { tags })).resolves.toEqual(struct);
    await timeout(100);
    await expect(cache.get(key, jest.fn, { tags })).resolves.toEqual(struct);
    await cache.touch(tags);
    await timeout(50);

    struct.a = 5;

    await expect(cache.get(key, executor, { tags })).resolves.toEqual(struct);
  });
});
