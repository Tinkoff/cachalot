import { EventEmitter } from "events";
import { ConnectionStatus } from "../ConnectionStatus";
import customError from "../errors/custom-error";
import { StorageAdapter } from "../StorageAdapter";

export const DEFAULT_LOCK_EXPIRES = 20000;

interface Memcached extends EventEmitter {
  add(
    key: string,
    value: string,
    lifetime: number,
    cb: (err: Error | undefined, result: boolean) => void
  ): void;

  get(key: string, cb: (err: Error | undefined, data: string) => void): void;

  getMulti(keys: string[], cb: (err: Error | undefined, data: { [key: string]: string }) => void): void;

  set(
    key: string,
    value: string,
    lifetime: number,
    cb: (err: Error | undefined, result: boolean) => void
  ): void;

  del(key: string, cb: (err: Error | undefined, result: boolean) => void): void;
}

function operationError(op: string, err: Error): Error {
  return customError("operationError", `Operation "${op}" error. ${err.message}`, err);
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

  private connectionStatus: ConnectionStatus = ConnectionStatus.CONNECTED;
  private memcachedInstance: Memcached;
  private options: MemcachedStorageAdapterOptions;

  /**
   * The method should call the callback passed to it as soon as the storage is ready to execute commands.
   */
  onConnect(callback: (err: unknown) => void): void {
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
    const lifetime = this.getLifetimeFromMs(expiresIn);

    return new Promise<boolean>((resolve, reject) => {
      this.memcachedInstance.set(key, value, lifetime, (err, result) => {
        if (err) {
          return reject(operationError("set", err));
        }

        resolve(result);
      });
    });
  }

  /**
   * mset - stores values to the storage
   */
  async mset(values: Map<string, string>): Promise<void> {
    if (values.size === 0) {
      throw new Error("ERR wrong number of arguments for 'mset' command");
    }

    await Promise.all([...values.entries()].map(([key, value]) => this.set(key, value)));
  }

  /**
   * get - returns value by key
   * Returns null if record does not exist
   */
  async get(key: string): Promise<string | null> {
    if (key === "") {
      throw new Error("ERR wrong arguments for 'get' command");
    }

    return new Promise((resolve, reject) => {
      this.memcachedInstance.get(key, (err, result) => {
        if (err) {
          return reject(operationError("get", err));
        }

        return resolve(result || null);
      });
    });
  }

  /**
   * mget - returns values by keys
   * Returns null for records that do not exist
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    return new Promise((resolve, reject) => {
      this.memcachedInstance.getMulti(keys, (err, result) => {
        if (err) {
          return reject(operationError("mget", err));
        }

        resolve(
          keys.map(key => {
            if (result[key] === undefined) {
              return null;
            }

            return result[key];
          })
        );
      });
    });
  }

  /**
   * Removes the entry with the key key from storage
   */
  async del(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.memcachedInstance.del(key, (err, result) => {
        if (err) {
          return reject(operationError("del", err));
        }

        return resolve(result);
      });
    });
  }

  /**
   * Locks the entry with the key key to be changed, returns true if the operation is successful, otherwise false
   */
  async acquireLock(key: string, lockExpireTimeout?: number): Promise<boolean> {
    const expiresIn = lockExpireTimeout !== undefined ? lockExpireTimeout : this.options.lockExpireTimeout;

    return new Promise((resolve, reject) => {
      this.memcachedInstance.add(`${key}_lock`, "", this.getLifetimeFromMs(expiresIn), (err, result) => {
        if (err) {
          return reject(operationError("acquireLock", err));
        }

        resolve(result);
      });
    });
  }

  /**
   * Unlocks the record with the key key, returns true if the operation is successful, otherwise false
   */
  async releaseLock(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.memcachedInstance.del(`${key}_lock`, (err, result) => {
        if (err) {
          return reject(operationError("releaseLock", err));
        }

        resolve(result);
      });
    });
  }

  /**
   * Checks if the entry with the key key is locked for changes
   */
  async isLockExists(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.memcachedInstance.get(`${key}_lock`, (err, result) => {
        if (err) {
          return reject(operationError("isLockExists", err));
        }

        resolve(result !== null && result !== undefined);
      });
    });
  }

  /**
   * Changes adapter connection status
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
  }

  /**
   * Since memcached throws "bad command line format" if float value is
   * passed as lifetime, we need to ceil it together with converting to seconds.
   */
  private getLifetimeFromMs(expiresMs: number | undefined): number {
    const SECOND = 1000;

    if (expiresMs && isFinite(Number(expiresMs)) && expiresMs > 0) {
      return Math.ceil(expiresMs / SECOND);
    }

    return 0;
  }
}

export default MemcachedStorageAdapter;
