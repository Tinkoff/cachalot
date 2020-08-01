import { ConnectionStatus } from "./ConnectionStatus";
import { Executor, runExecutor } from "./Executor";
import { Logger } from "./Logger";
import { Manager } from "./Manager";
import { ManagerOptions } from "./managers/BaseManager";
import RefreshAheadManager from "./managers/RefreshAheadManager";
import { BaseStorage } from "./storage/BaseStorage";
import { Record } from "./storage/Record";
import { ReadWriteOptions, Storage, WriteOptions } from "./storage/Storage";
import { StorageAdapter } from "./StorageAdapter";

export interface CacheWithCustomStorageOptions {
  storage: Storage;
}
export interface CacheWithBaseStorageOptions {
  adapter: StorageAdapter;
  tagsAdapter?: StorageAdapter;
}

export interface ManagerConstructor<T extends Manager> {
  new (options: ManagerOptions): T;
  getName(): string;
}

export type CacheOptions = (CacheWithCustomStorageOptions | CacheWithBaseStorageOptions) & {
  logger: Logger;
  expiresIn?: number;
  prefix?: string;
  hashKeys?: boolean;
};

export const isCustomStorageOptions = (options: unknown): options is CacheWithCustomStorageOptions =>
  Object.prototype.hasOwnProperty.call(options, "storage");

export const isBaseStorageOptions = (options: unknown): options is CacheWithBaseStorageOptions =>
  Object.prototype.hasOwnProperty.call(options, "adapter");

export interface ManagerSelectorOptions {
  manager?: string;
}

export const EXPIRES_IN = {
  minute: 60000,
  hour: 3600000,
  day: 86400000,
};

/**
 * Cache is the basic class of CacheManager.
 * @example
 *
 * ```typescript
 * // Cache.ts
 * import logger from './logger';
 * import Cache, { RedisStorageAdapter } from 'cachalot';
 *
 * const redis = new Redis();
 *
 * export const cache = new Cache({
 *   adapter: new RedisStorageAdapter(redisClient),
 *   logger,
 * });
 *  ```
 */
class Cache {
  constructor(options: CacheOptions) {
    if (isCustomStorageOptions(options)) {
      this.storage = options.storage;
    } else if (isBaseStorageOptions(options)) {
      this.storage = new BaseStorage({
        adapter: options.adapter,
        tagsAdapter: options.tagsAdapter,
        prefix: options.prefix,
        hashKeys: options.hashKeys,
      });
    } else {
      throw new Error("Either custom storage or storage adapter must be passed in options.");
    }

    if (!options.logger) {
      throw new Error("Logger is required.");
    }

    this.logger = options.logger;
    this.expiresIn = options.expiresIn || EXPIRES_IN.day;

    this.managers = new Map();
    this.registerManager(RefreshAheadManager);
  }

  private readonly storage: Storage;
  private readonly logger: Logger;
  private readonly expiresIn: number;
  private managers: Map<string, Manager>;

  /**
   * Get delegates call to default or provided manager. The only thing it does by itself is checking
   * the connection status of storage. If storage is disconnected calls executor directly and returns result.
   */
  public async get<R>(
    key: string,
    executor: Executor<R>,
    options: ReadWriteOptions<R> & ManagerSelectorOptions = {}
  ): Promise<R> {
    const connectionStatus = this.storage.getConnectionStatus();

    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      this.logger.error(
        `Storage connection status is "${connectionStatus}", cache is unavailable!. Running executor.`
      );

      return runExecutor(executor);
    }

    const { manager: managerName = RefreshAheadManager.getName(), expiresIn = this.expiresIn } = options;
    const computedOptions = { ...options, expiresIn };
    const manager = this.getManager(managerName);

    return manager.get(key, executor, computedOptions);
  }

  /**
   * Just like "get" this method delegates call to default or provided manager
   */
  public async set<R>(
    key: string,
    value: R,
    options: WriteOptions<R> & ManagerSelectorOptions = {}
  ): Promise<Record<R>> {
    const { manager: managerName = RefreshAheadManager.getName(), expiresIn = this.expiresIn } = options;
    const computedOptions = { ...options, expiresIn };
    const manager = this.getManager(managerName);

    return manager.set(key, value, computedOptions);
  }

  /**
   * The touch method is intended for all cases when you need to inform the cache manager that the data for
   * any tags are updated without making a cache entry;
   *
   * @example
   *
   * ```typescript
   * await saveNews(news);
   * cache.touch(['news']);
   * ```
   */
  public async touch(tags: string[]): Promise<void> {
    return this.storage.touch(tags);
  }

  /**
   * Register a new cache manager
   */
  public registerManager<T extends Manager>(
    managerClass: ManagerConstructor<T>,
    name?: string | null,
    options: Partial<ManagerOptions> = {}
  ): void {
    this.managers.set(
      name || managerClass.getName(),
      new managerClass({
        logger: this.logger,
        storage: this.storage,
        ...options,
      })
    );
  }

  /**
   * Returns cache manager by its name
   */
  private getManager(name: string): Manager {
    const manager = this.managers.get(name);

    if (!manager) {
      throw new Error(`Unknown manager "${name}"`);
    }

    return manager;
  }
}

export default Cache;
