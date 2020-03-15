import { LockedKeyRetrieveStrategyType } from "../LockedKeyRetrieveStrategy";
import { ConnectionStatus } from "../ConnectionStatus";
import { Record } from "./Record";

/**
 * Storage is an abstraction over different operations with records
 * It manipulates with it's own Record type which is abstraction
 * over simple storage keys
 */
export interface Storage {
  get(key: string): Promise<Record | null>;
  touch(tags: string[]): Promise<any>;
  lockKey(key: string): Promise<boolean>;
  releaseKey(key: string): Promise<boolean>;
  keyIsLocked(key: string): Promise<boolean>;
  del(key: string): Promise<boolean>;
  getTags(tagNames: string[]): Promise<Tag[]>;
  set(key: string, value: RecordValue, options?: WriteOptions): Promise<any>;
  getConnectionStatus(): ConnectionStatus;
}

/**
 * Cache key tag In this form, tags are stored in the adapter's storage.
 */
export interface Tag {
  /**
   * Tag ID
   */
  name: string;
  /**
   * Tag version in unixtime
   */
  version: number;
}

export type RecordValue = object | string | number | null;

export type Tags = {
  [tagName: string]: Tag;
};

/**
 * Settings for getting the Record. Used in get
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
  tags?: string[] | (() => string[]);
  /**
   * getTags allows to detect tags for record depending on executor result
   */
  getTags?: (executorResult: any) => string[];
}

export type ReadWriteOptions = ReadOptions & WriteOptions;
