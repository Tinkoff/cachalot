import { StorageAdapter } from "../StorageAdapter";
import Memcached from "memcached";
import {ConnectionStatus} from "../ConnectionStatus";
import customError from "../custom-error";

const SECOND = 1000;
const CACHE_PREFIX = "cache";
export const DEFAULT_LOCK_EXPIRES = 20000;

function cacheKey(key: string): string {
  return `${CACHE_PREFIX}:${key}`;
}

export function OperationError(op: string, err: Error): Error {
  const text = `Operation "${op}" error`;

  return customError("OperationError", text, err);
}

export type MemcachedStorageAdapterOptions = {
  lockExpireTimeout: number;
};

/**
 * Memcached adapter for Manager. Implements the StorageAdapter interface
 */
export class MemcachedStorageAdapter implements StorageAdapter {
  /**
   * The adapter's constructor takes as its input the only parameter - the memcached instance (new Memcached)
   */
  constructor(memcachedInstance: Memcached, options?: MemcachedStorageAdapterOptions) {
    this.memcachedInstance = memcachedInstance;
    this.options = {
      lockExpireTimeout: DEFAULT_LOCK_EXPIRES,
      ...options,
    };
    this.memcachedInstance.on("reconnect", () => this.setConnectionStatus(ConnectionStatus.CONNECTED));
    this.memcachedInstance.on("reconnecting", () => this.setConnectionStatus(ConnectionStatus.CONNECTING));
    this.memcachedInstance.on("failure", () => this.setConnectionStatus(ConnectionStatus.DISCONNECTED));
  }

  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private memcachedInstance: Memcached;
  private options: MemcachedStorageAdapterOptions;

  /**
   * The method should call the callback passed to it as soon as the storage is ready to execute commands.
   */
  onConnect(callback: (...args: any[]) => any): void {
    this.memcachedInstance.on("reconnect", callback);
  }

  /**
   * Returns the current status of the storage connection.
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * set - sets the value for the key key in storage.
   * Returns true on success; false otherwise.
   */
  async set(key: string, value: string, expiresIn?: number): Promise<boolean> {
    let lifetime = 0;

    if (expiresIn && isFinite(Number(expiresIn)) && expiresIn > 0) {
      lifetime = expiresIn / SECOND;
    }

    return new Promise<boolean>(((resolve, reject) => {
      this.memcachedInstance.set(cacheKey(key), value, lifetime, ((err, result) => {
        if (err) {
          return reject(OperationError("set", err))
        }

        resolve(result)
      }))
    }))
  }

  /**
   * mset - stores values to the storage
   */
  async mset(values: Map<string, string>): Promise<void> {
    await Promise.all([...values.entries()]
      .map(([key, value]) => this.set(key, value)))
  }

  /**
   * get - returns value by key
   * Returns null if record does not exist
   */
  async get(key: string): Promise<string | null> {
    return new Promise(((resolve, reject) => {
      this.memcachedInstance.get(cacheKey(key), ((err, result) => {
        if (err) {
          return reject(OperationError("get", err))
        }

        return resolve(result || null)
      }))
    }))
  }

  /**
   * mget - returns values by keys
   * Returns null for records that do not exist
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    const cacheKeys = keys.map(cacheKey);

    return new Promise(((resolve, reject) => {
      this.memcachedInstance.getMulti(cacheKeys, ((err, result) => {
        if (err) {
          return reject(OperationError("mget", err))
        }

        resolve(Object.values(result))
      }))
    }))
  }

  /**
   * Removes the entry with the key key from storage
   */
  async del(key: string): Promise<boolean> {
    return new Promise(((resolve, reject) => {
      this.memcachedInstance.del(cacheKey(key), ((err, result) => {
        if (err) {
          return reject(OperationError("del", err))
        }

        return resolve(result)
      }))
    }))
  }

  /**
   * Locks the entry with the key key to be changed, returns true if the operation is successful, otherwise false
   */
  async acquireLock(key: string): Promise<boolean> {
    return new Promise<boolean>(((resolve, reject) => {
      this.memcachedInstance.add(cacheKey(`${key}_lock`), "", this.options.lockExpireTimeout, ((err, result) => {
        if (err) {
          return reject(OperationError("acquireLock", err))
        }

        resolve(result)
      }))
    }))
  }

  /**
   * Unlocks the record with the key key, returns true if the operation is successful, otherwise false
   */
  async releaseLock(key: string): Promise<boolean> {
    return new Promise(((resolve, reject) => {
      this.memcachedInstance.del(cacheKey(`${key}_lock`), ((err, result) => {
        if (err) {
          return reject(OperationError("releaseLock", err))
        }

        resolve(result)
      }))
    }))
  }

  /**
   * Checks if the entry with the key key is locked for changes
   */
  async isLockExists(key: string): Promise<boolean> {
    return new Promise(((resolve, reject) => {
      this.memcachedInstance.get(cacheKey(`${key}_lock`), ((err, result) => {
        if (err) {
          return reject(OperationError("isLockExists", err))
        }

        resolve(result !== null && result !== undefined)
      }))
    }))
  }

  /**
   * Changes adapter connection status
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
  }
}

export default MemcachedStorageAdapter;
