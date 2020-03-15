import { Redis } from "ioredis";
import _, { partial } from "lodash";
import { ConnectionStatus } from "../ConnectionStatus";
import { StorageAdapter } from "../StorageAdapter";
import { withTimeout } from "../with-timeout";

/**
 * Hash prefix, used in set, get commands
 */
export const CACHE_PREFIX = "cache";
export const DEFAULT_OPERATION_TIMEOUT = 150;
export const DEFAULT_LOCK_EXPIRES = 20000;

export type RedisStorageAdapterOptions = {
  operationTimeout?: number;
  lockExpireTimeout?: number;
};

function cacheKey(key: string): string {
  return `${CACHE_PREFIX}:${key}`;
}

/**
 * Redis adapter for Manager. Implements the StorageAdapter interface
 */
export class RedisStorageAdapter implements StorageAdapter {
  /**
   * The adapter's constructor takes as its input the only parameter - the redis instance (new Redis)
   */
  constructor(redisInstance: any, options?: RedisStorageAdapterOptions) {
    this.redisInstance = redisInstance;
    this.options = {
      operationTimeout: DEFAULT_OPERATION_TIMEOUT,
      lockExpireTimeout: DEFAULT_LOCK_EXPIRES,
      ...options,
    };
    this.redisInstance.on("ready", () => this.setConnectionStatus(ConnectionStatus.CONNECTED));
    this.redisInstance.on("reconnecting", () => this.setConnectionStatus(ConnectionStatus.CONNECTING));
    this.redisInstance.on("end", () => this.setConnectionStatus(ConnectionStatus.DISCONNECTED));

    this.withTimeout = partial(withTimeout, _, this.options.operationTimeout);
  }

  /**
   * Storage adapter options
   */
  private options: Required<RedisStorageAdapterOptions>;

  /**
   * Instance of ioredis client (https://github.com/luin/ioredis)
   */
  private redisInstance: Redis;

  /**
   * Redis connection status
   */
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;

  private readonly withTimeout: <T>(promise: Promise<T>) => Promise<T>;

  /**
   * Returns the status of the connection with redis (see StorageAdapter)
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Implementing this method in the redis adapter will trigger a callback as soon as the redis send event to the 'ready' event.
   */
  public onConnect(callback: (...args: any[]) => void): void {
    this.redisInstance.on("ready", callback);
  }

  /**
   * The set method provided by the adapter.
   * Use set command to set hash value in radish
   */
  public async set(key: string, value: string, expiresIn?: number): Promise<boolean> {
    const setPromise = expiresIn
      ? this.redisInstance.set(cacheKey(key), value, "PX", expiresIn)
      : this.redisInstance.set(cacheKey(key), value);

    return Boolean(await this.withTimeout(setPromise));
  }

  /**
   * Set multiple values to redis storage
   */
  public async mset(values: Map<string, any>): Promise<void> {
    const data = new Map<string, any>();

    for (const [key, value] of values.entries()) {
      data.set(cacheKey(key), value);
    }

    await this.withTimeout(this.redisInstance.mset(data));
  }

  /**
   * The get command method provided by the adapter. Use get command to get key value from redis
   */
  public async get(key: string): Promise<string | null> {
    return this.withTimeout(this.redisInstance.get(cacheKey(key)));
  }

  /**
   * The mget command method provided by the adapter.
   * Use mget command to get multiple values from redis
   */
  public async mget(keys: string[]): Promise<(string | null)[]> {
    const cacheKeys = keys.map(cacheKey);
    return this.withTimeout(this.redisInstance.mget(...cacheKeys));
  }

  /**
   * The del method provided by the adapter. Uses the del command to remove the key.
   */
  public async del(key: string): Promise<boolean> {
    return await this.withTimeout(this.redisInstance.del(cacheKey(key))) > 0;
  }

  /**
   * Set the lock on the key
   */
  public async acquireLock(key: string): Promise<boolean> {
    const setResult = await this.withTimeout(
      this.redisInstance.set(cacheKey(`${key}_lock`), "", "PX", this.options.lockExpireTimeout, "NX")
    );

    return setResult === "OK";
  }

  /**
   * Unlocks the key
   */
  public async releaseLock(key: string): Promise<boolean> {
    const deletedKeys = await this.withTimeout(this.redisInstance.del(cacheKey(`${key}_lock`)));

    return deletedKeys > 0;
  }

  /**
   * Checks if key is locked
   */
  public async isLockExists(key: string): Promise<boolean> {
    const lockExists = await this.withTimeout(this.redisInstance.exists(cacheKey(`${key}_lock`)));

    return lockExists === 1;
  }

  /**
   * Changes adapter connection status
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
  }
}

export default RedisStorageAdapter;