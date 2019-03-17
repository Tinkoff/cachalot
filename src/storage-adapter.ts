import { ConnectionStatus } from './connection-status';

/**
 * The interface of the settings object required to transfer parameters from the Manager to the StorageAdapter
 * for later use in its methods set, get, del, etc.
 */
export interface StorageAdapterOptions {
  expiresIn?: number;
}

/**
 * Interface adapter for class Manager. Adapter is "interlayer"
 * between storage methods and the manager itself. Any adapter
 * must implement all methods and properties of this interface
 */
export interface StorageAdapter {
  /**
   * The method sends the settings from above (from BaseManager) to the adapter. Called in the BaseManager constructor if set
   */
  setOptions?(options: StorageAdapterOptions): void;

  /**
   * The method should call the callback passed to it as soon as the storage is ready to execute commands.
   */
  onConnect(callback: (...args: any[]) => any): void;

  /**
   * Returns the current status of the storage connection.
   */
  getConnectionStatus(): ConnectionStatus;

  /**
   * set - sets the value for the key key in storage.
   * Returns true on success; false otherwise.
   */
  set(key: string, value: string, expiresIn?: number): Promise<boolean>;

  /**
   * get - возвращает значение для ключа key
   * Если запись отсутствует, возвращает null
   */
  get(key: string): Promise<string | null>;

  /**
   * Removes the entry with the key key from storage
   */
  del(key: string): Promise<void>;

  /**
   * Locks the entry with the key key to be changed, returns true if the operation is successful, otherwise false
   */
  acquireLock(key: string): Promise<boolean>;

  /**
   * Unlocks the record with the key key, returns true if the operation is successful, otherwise false
   */
  releaseLock(key: string): Promise<boolean>;

  /**
   * Checks if the entry with the key key is locked for changes
   */
  isLockExists(key: string): Promise<boolean>;
}
