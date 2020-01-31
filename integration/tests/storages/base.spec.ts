import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import RedisStorageAdapter from '../../../src/adapters/redis';
import { BaseStorage, NOT_TOUCHED_TAGS_CACHE_KEY } from '../../../src/storages/base';

const redis = new Redis();
const adapter = new RedisStorageAdapter(redis);
const prefix = 'cache';
const storage = new BaseStorage({ adapter, prefix });

describe('Base storage', () => {
  beforeEach(async () => {
    await redis.flushall();
  });

  describe('set', () => {
    it('set no tags if no tag specified', async () => {
      const key = uuid();
      const value = uuid();
      await storage.set(key, value);

      await expect(redis.keys('*')).resolves.toEqual([`cache:cache-${key}`]);
    });

    it('adds new tag to not touched', async () => {
      const key = uuid();
      const value = uuid();
      const tag = 'newTag';
      await storage.set(key, value, { tags: [tag] });

      await expect(redis.smembers(`cache:${NOT_TOUCHED_TAGS_CACHE_KEY}`)).resolves.toEqual([tag]);

      const keys = await redis.keys('*');
      expect(keys.sort()).toEqual([`cache:cache-${key}`, `cache:${NOT_TOUCHED_TAGS_CACHE_KEY}`]);
    });

    it('adds only new tag to not touched and omits existing tag', async () => {
      const key = uuid();
      const value = uuid();
      const tag = 'newTag';
      const existingTag = 'existingTag';
      const tagVersionKey = `cache:cache-cache-tags-versions:${existingTag}`;

      await redis.set(tagVersionKey, 1);
      await storage.set(key, value, { tags: [tag, existingTag] });

      await expect(redis.smembers(`cache:${NOT_TOUCHED_TAGS_CACHE_KEY}`)).resolves.toEqual([tag]);
      await expect(redis.get(tagVersionKey)).resolves.toEqual('1');
    });

    it('does not modify not touched if all tags exist', async () => {
      const key = uuid();
      const value = uuid();
      const existingTag = 'existingTag';
      const tagVersionKey = `cache:cache-cache-tags-versions:${existingTag}`;

      await redis.set(tagVersionKey, 1);
      await storage.set(key, value, { tags: [existingTag] });

      await expect(redis.smembers(`cache:${NOT_TOUCHED_TAGS_CACHE_KEY}`)).resolves.toEqual([]);
      await expect(redis.get(tagVersionKey)).resolves.toEqual('1');
    });
  });

  describe('touch', () => {
    it('removes tag from not touched', async () => {
      const tag = 'notTouchedTag';
      await redis.sadd(`cache:${NOT_TOUCHED_TAGS_CACHE_KEY}`, tag);

      await storage.touch([tag]);

      await expect(redis.smembers(`cache:${NOT_TOUCHED_TAGS_CACHE_KEY}`)).resolves.toEqual([]);
      await expect(redis.get(`cache:cache-cache-tags-versions:${tag}`)).resolves.not.toEqual('0');
    });

    it('preserves not touched if touched only existing tags', async () => {
      const existingTag = 'existingTag';
      const tagVersionKey = `cache:cache-cache-tags-versions:${existingTag}`;
      await redis.set(tagVersionKey, 1);

      await storage.touch([existingTag]);

      await expect(redis.smembers(`cache:${NOT_TOUCHED_TAGS_CACHE_KEY}`)).resolves.toEqual([]);
      await expect(redis.get(tagVersionKey)).resolves.not.toEqual('0');
    });
  });

  describe('getTags', () => {
    it('returns correct version for unknown tag', async () => {
      const tag = 'unknownTag';

      await expect(storage.getTags([tag])).resolves.toEqual([{ name: tag, version: 0 }]);
    });

    it('returns correct version for not touched tag', async () => {
      const tag = 'notTouchedTag';
      await redis.sadd(`cache:${NOT_TOUCHED_TAGS_CACHE_KEY}`, tag);

      const tags = await storage.getTags([tag]);
      expect(tags).toEqual([{ name: tag, version: 0 }]);
    });

    it('returns correct version for existing tag', async () => {
      const existingTag = 'existingTag';
      const tagVersionKey = `cache:cache-cache-tags-versions:${existingTag}`;
      await redis.set(tagVersionKey, 1);

      const tags = await storage.getTags([existingTag]);

      expect(tags).toEqual([{ name: existingTag, version: 1 }]);
    });

    it('returns correct version for mixed tags', async () => {
      const existingTag = 'existingTag';
      const tagVersionKey = `cache:cache-cache-tags-versions:${existingTag}`;
      await redis.set(tagVersionKey, 1);

      const notTouchedTag = 'notTouchedTag';
      const notTouchedUnusedTag = 'notTouchedUnusedTag';
      await redis.sadd(`cache:${NOT_TOUCHED_TAGS_CACHE_KEY}`, notTouchedTag, notTouchedUnusedTag);

      const getActualTagsSpy = jest.spyOn(storage as any, 'getActualTags');

      const tags = await storage.getTags([existingTag, notTouchedTag]);

      expect(getActualTagsSpy).toHaveBeenLastCalledWith([existingTag]);

      expect(tags).toEqual([
        { name: notTouchedTag, version: 0 },
        { name: existingTag, version: 1 }
      ]);
    });
  });

  describe('Combo', () => {
    it('works', async () => {
      const tag1 = 'tag1';

      await storage.set(uuid(), uuid(), { tags: [tag1]});
      await expect(storage.getTags([tag1])).resolves.toEqual([{ name: tag1, version: 0 }]);

      await storage.touch([tag1]);
      const tags = await storage.getTags([tag1]);
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toEqual(tag1);
      expect(tags[0].version).toBeGreaterThan(0);

      const tag2 = 'tag2';
      await storage.set(uuid(), uuid(), { tags: [tag2]});
      const tags2 = await storage.getTags([tag1, tag2]);
      expect(tags2).toHaveLength(2);
      expect(tags2[0]).toEqual({ name: tag2, version: 0 });
      expect(tags2[1]).toEqual(tags[0]);

      await storage.touch([tag1, tag2]);
      const tags3 = await storage.getTags([tag1, tag2]);
      expect(tags3).toHaveLength(2);
      expect(tags3[0].name).toEqual(tag1);
      expect(tags3[0].version).not.toEqual(tags[0].version);
      expect(tags3[1].name).toEqual(tag2);
      expect(tags3[1].version).toBeGreaterThan(0);
    });
  });
});
