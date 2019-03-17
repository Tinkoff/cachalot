import { KeyType, Redis } from 'ioredis';
import { ConnectionStatus } from '../../connection-status';
import { StorageAdapter } from '../../storage-adapter';
import { withTimeout } from '../../with-timeout';

/**
 * Hash prefix, used in set, get commands
 */
export const CACHE_PREFIX = 'cache';
export const DEFAULT_OPERATION_TIMEOUT = 200;
export const DEFAULT_LOCK_EXPIRES = 20000;

export type CommandArgument = string | number;

export type RedisStorageAdapterOptions = {
  operationTimeout?: number;
  lockExpireTimeout?: number;
};

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
      ...options
    };
    this.redisInstance.on('ready', () => this.setConnectionStatus(ConnectionStatus.CONNECTED));
    this.redisInstance.on('reconnecting', () => this.setConnectionStatus(ConnectionStatus.CONNECTING));
    this.redisInstance.on('end', () => this.setConnectionStatus(ConnectionStatus.DISCONNECTED));
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
    this.redisInstance.on('ready', callback);
  }

  /**
   * The set method provided by the adapter.
   * Use set command to set hash value in radish
   */
  public async set(key: string, value: string, expiresIn?: number): Promise<boolean> {
    const commands: [KeyType, CommandArgument] = [`${CACHE_PREFIX}:${key}`, value];

    if (expiresIn) {
      commands.push('PX', expiresIn);
    }

    return Boolean(await withTimeout(
      this.redisInstance.set(...commands), this.options.operationTimeout));
  }

  /**
   * The get command method provided by the adapter. Use get command to get key value from redis
   */
  public async get(key: string): Promise<string | null> {
    return withTimeout(this.redisInstance.get(`${CACHE_PREFIX}:${key}`), this.options.operationTimeout);
  }

  /**
   * The del method provided by the adapter. Uses the del command to remove the key.
   */
  public async del(key: string): Promise<void> {
    return withTimeout(this.redisInstance.del(`${CACHE_PREFIX}:${key}`), this.options.operationTimeout);
  }

  /**
   * Set the lock on the key
   */
  public async acquireLock(key: string): Promise<boolean> {
    const setResult = await withTimeout(this.redisInstance.set(
      `${key}_lock`,
      '',
      'PX',
      this.options.lockExpireTimeout,
      'NX'
    ), this.options.operationTimeout);

    return setResult === 'OK';
  }

  /**
   * Unlocks the key
   */
  public async releaseLock(key: string): Promise<boolean> {
    const deletedKeys = await withTimeout(this.redisInstance.del(`${key}_lock`), this.options.operationTimeout);

    return deletedKeys > 0;
  }

  /**
   * Checks if key is locked
   */
  public async isLockExists(key: string): Promise<boolean> {
    const lockExists = await withTimeout(this.redisInstance.exists(`${key}_lock`), this.options.operationTimeout);

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
