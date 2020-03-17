import { StorageAdapter, StorageAdapterOptions } from "./StorageAdapter";
import { Tag, Tags } from "./storage/Storage";
import {Record, RecordValue} from "./storage/Record";
import Cache, { CacheOptions } from "./Cache";
import RedisStorageAdapter from "./adapters/RedisStorageAdapter";
import MemcachedStorageAdapter from "./adapters/MemcachedStorageAdapter";
import ReadThroughManager from "./managers/ReadThroughManager";
import WriteThroughManager from "./managers/WriteThroughManager";
import RefreshAheadManager from "./managers/RefreshAheadManager";

export {
  CacheOptions,
  StorageAdapter,
  StorageAdapterOptions,
  Record,
  Tag,
  RecordValue,
  Tags,
  RedisStorageAdapter,
  MemcachedStorageAdapter,
  ReadThroughManager,
  RefreshAheadManager,
  WriteThroughManager,
};
export * from "./errors/constants";
export { LockedKeyRetrieveStrategy } from "./LockedKeyRetrieveStrategy";
export default Cache;
