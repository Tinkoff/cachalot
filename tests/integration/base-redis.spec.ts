import Redis from "ioredis";
import { runStorageTests } from "./base-agnostic";
import RedisStorageAdapter from "../../src/adapters/RedisStorageAdapter";
import { BaseStorage } from "../../src/storage/BaseStorage";

const redis = new Redis();
const adapter = new RedisStorageAdapter(redis, { operationTimeout: 9000 });
const prefix = "cache";
const storage = new BaseStorage({ adapter, prefix });

describe("Base storage - redis", () => {
  beforeEach(async () => {
    await redis.flushall();
  });

  runStorageTests(storage, adapter);
});
