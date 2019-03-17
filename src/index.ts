import { StorageAdapter, StorageAdapterOptions } from './storage-adapter';
import { StorageRecord, StorageRecordTag, StorageRecordValue, StorageTags } from './storage';
import Cache, { CacheOptions } from './cache';
import RedisStorageAdapter from './adapters/redis';
import ReadThroughManager from './managers/read-through';
import WriteThroughManager from './managers/write-through';
import RefreshAheadManager from './managers/refresh-ahead';

export {
  CacheOptions,
  StorageAdapter,
  StorageAdapterOptions,
  StorageRecord,
  StorageRecordTag,
  StorageRecordValue,
  StorageTags,
  RedisStorageAdapter,
  ReadThroughManager,
  RefreshAheadManager,
  WriteThroughManager
};
export * from './constants';
export { LockedKeyRetrieveStrategy } from './locked-key-retrieve-strategy';
export default Cache;
