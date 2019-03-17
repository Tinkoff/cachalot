import { LockedKeyRetrieveStrategyType } from './locked-key-retrieve-strategy';
import { ConnectionStatus } from './connection-status';

/**
 * Storage is an abstraction over different operations with records
 * It manipulates with it's own StorageRecord type which is abstraction
 * over simple storage keys
 */
export interface Storage {
  get(key: string): Promise<StorageRecord | null>;
  touch(tags: string[]): Promise<any>;
  lockKey(key: string): Promise<boolean>;
  releaseKey(key: string): Promise<boolean>;
  keyIsLocked(key: string): Promise<boolean>;
  del(key: string): Promise<any>;
  getTags(tagNames: string[]): Promise<StorageRecordTag[]>;
  set(key: string, value: StorageRecordValue, options?: WriteOptions): Promise<any>;
  getConnectionStatus(): ConnectionStatus;
}

/**
 * Cache key tag In this form, tags are stored in the adapter's storage.
 */
export interface StorageRecordTag {
  /**
   * Tag ID
   */
  name: string;
  /**
   * Tag version in unixtime
   */
  version: number;
}

/**
 * Key interface in cache storage. Any adapter and other modules related to the storage of cache entries
 * must implement this interface.
 */
export interface StorageRecord {
  /**
   * Record key
   */
  key: string;
  /**
   * Is the key is "permanent". Permanent key is not treats as invalid when it expires
   */
  permanent: boolean;
  /**
   * Key lifetime in milliseconds
   */
  expiresIn: number;
  /**
   * The time in unixtime when the key was created
   */
  createdAt: number;
  /**
   * Key value
   */
  value?: StorageRecordValue;
  /**
   * Cache tags Array with pairs of tag name and version. The version is stored as unixtime.
   */
  tags: StorageRecordTag[];
}

export type StorageRecordValue = object | string | number | null;
export type StorageTags = {
  [tagName: string]: StorageRecordTag;
};

/**
 * Settings for getting the StorageRecord. Used in get
 */
export interface ReadOptions {
  /**
   * When reading a key, it is possible to set a strategy for behavior when a key expires. lockedKeyRetrieveStrategyType sets
   * name of the strategy used. If not specified, the default strategy will be used.
   */
  lockedKeyRetrieveStrategyType?: LockedKeyRetrieveStrategyType | string;
}

export interface ExpireOptions {
  /**
   * The number of milliseconds after which the key values are considered obsolete
   */
  expiresIn?: number;
  /**
   * Is the key "permanent"? Permanent key is not disabled when expiresIn
   */
  permanent?: boolean;
}

export interface WriteOptions extends ExpireOptions {
  /**
   * Tags - are keys for which the manager checks the validity of a particular entry.
   * If the tag value is in the cache and invalidation time < current time, the tag will be considered invalid and
   * the record will need to be obtained using the executor
   */
  tags?: string[];
}

export type ReadWriteOptions = ReadOptions & WriteOptions;
