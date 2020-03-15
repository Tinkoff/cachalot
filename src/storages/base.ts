import { createHash } from 'crypto';
import isFunction from 'lodash/isFunction';
import uniq from 'lodash/uniq';
import { ConnectionStatus } from '../connection-status';
import deserialize from '../deserialize';
import { isOperationTimeoutError } from '../errors';
import createRecord from '../record';
import createTag from '../record/create-tag';
import serialize from '../serialize';
import { Storage, StorageRecord, StorageRecordTag, StorageRecordValue, WriteOptions } from '../storage';
import { StorageAdapter } from '../storage-adapter';

export const TAGS_VERSIONS_ALIAS = 'cache-tags-versions';

export type BaseStorageOptions = {
  adapter: StorageAdapter;
  tagsAdapter?: StorageAdapter;
  prefix?: string;
  hashKeys?: boolean;
  expiresIn?: number;
};

/**
 * Command is used as item of offline queue, which is used when adapter status becomes offline.
 * When adapter status becomes online, Storage flushes the queue and executes this commands.
 * Commands which was not executed successfully will be re-queued.
 */
export interface Command {
  fn: CommandFn;
  params: any[];
}

/**
 * CommandFn is a function (usually a Storage method bind to its context) which is stored in
 * Command object for further execution.
 */
export type CommandFn = (...args: any[]) => any;

/**
 * BaseStorage is the default Storage implementation for Manager.
 *
 * It provides functionality of get, set, touching tags, locking keys etc.
 * It also manages command execution, supporting an "offline" queue of commands.
 */
export class BaseStorage implements Storage {
  constructor(options: BaseStorageOptions) {
    this.adapter = options.adapter;
    this.tagsAdapter = options.tagsAdapter ?? options.adapter;
    this.prefix = options.prefix || '';
    this.hashKeys = options.hashKeys || false;

    if (isFunction(this.adapter.setOptions)) {
      this.adapter.setOptions(options);
    }

    this.adapter.onConnect(async () => this.executeCommandsFromQueue());
  }

  /**
   * An offline commands queue.
   */
  private commandsQueue: Command[] = [];

  /**
   * The prefix is used to prevent conflicts in the key names of different BaseStorage instances.
   */
  private prefix: string;

  /**
   * Does it affect whether the keys are kept "as is" or they will be hashed. Hashing can be useful
   * for partitioning some databases.
   */
  private hashKeys: boolean;

  /**
   * The adapter is an interlayer between the underlying storage and the BaseStorage class.
   * Implements the StorageAdapter interface.
   */
  private adapter: StorageAdapter;

  /**
   * Adapter for tags should be provided if your primary adapter uses eviction policy.
   * This adapter should not use any eviction policy. Records should be deleted only by demand or expiration.
   */
  private readonly tagsAdapter: StorageAdapter;

  /**
   * Gets a record using an adapter. It is expected that the adapter returns or null (value not found)
   * or serialized StorageRecord.
   */
  public async get(key: string): Promise<StorageRecord | null> {
    const record = deserialize(await this.adapter.get(this.createKey(key)));

    if (!this.isRecord(record)) {
      return null;
    }

    return record;
  }

  /**
   * Creates new set of tag records and updates them.
   */
  public async setTagVersions(tags: StorageRecordTag[]): Promise<any> {
    const values = new Map(tags.map(tag => [this.createTagKey(tag.name), `${tag.version}`]));
    return this.tagsAdapter.mset(values);
  }

  /**
   * Invalidates tags given as array of strings.
   */
  public async touch(tags: string[]): Promise<void> {
    return this.cachedCommand(this.setTagVersions.bind(this), tags.map(createTag));
  }

  /**
   * Causes the adapter to acquireLock and resolves to true if the adapter responds that the lock is successful.
   */
  public async lockKey(key: string): Promise<boolean> {
    return this.adapter.acquireLock(this.createKey(key));
  }

  /**
   * Releases the lock of key.
   */
  public async releaseKey(key: string): Promise<boolean> {
    return this.adapter.releaseLock(this.createKey(key));
  }

  /**
   * Checks if key is locked and returns true/false.
   */
  public async keyIsLocked(key: string): Promise<boolean> {
    return this.adapter.isLockExists(this.createKey(key));
  }

  /**
   * Deletes record by key.
   */
  public async del(key: string): Promise<any> {
    return this.cachedCommand(this.adapter.del.bind(this.adapter), this.createKey(key));
  }

  /**
   * Retrieves actual versions of tags from storage. Tags which was not found in storage will be created with 0
   * version.
   */
  public async getTags(tagNames: string[]): Promise<StorageRecordTag[]> {
    const existingTags = await this.tagsAdapter.mget(tagNames.map(tagName => this.createTagKey(tagName)));

    return tagNames.map((tagName, index) => ({
      name: tagName,
      version: Number(existingTags[index]) || 0
    }));
  }

  /**
   * set creates new record with provided options and sets it to storage using the adapter.
   */
  public async set(key: string, value: StorageRecordValue, options: WriteOptions = {}): Promise<any> {
    let tags: string[] = [];
    if (isFunction(options.tags)) {
      tags = options.tags();
    } else if (options.tags !== undefined) {
      tags = options.tags;
    }
    const dynamicTags = isFunction(options.getTags) ? options.getTags(value) : [];

    if (!Array.isArray(dynamicTags)) {
      throw new TypeError(`getTags should return an array of strings, got ${typeof dynamicTags}`);
    }

    const record = createRecord(key, value, uniq(tags.concat(dynamicTags)).map(createTag), options);

    await this.adapter.set(
      this.createKey(key),
      serialize({ ...record, value: serialize(record.value) }),
      record.expiresIn
    );

    return record;
  }

  /**
   * Returns current connection status of storage.
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.adapter.getConnectionStatus();
  }

  /**
   * Checks if provided value is valid StorageRecord.
   */
  private isRecord(value: any): value is StorageRecord {
    return (value === null) || (typeof value === 'object' && value.key);
  }

  /**
   * Depending on the option, [hashKeys] generates an MD5 hash "key" for the storage or gives it "as is".
   * The key is generated from the "prefix" of the storage defined at the time of the creation of
   * the BaseStorage instance and identifier passed in the key parameter string.
   */
  private createKey(key: string): string {
    const rawKey = this.prefix ? `${this.prefix}-${key}` : key;

    return this.hashKeys ? createHash('md5').update(rawKey).digest('hex') : rawKey;
  }

  private createTagKey(tagName: string): string {
    return this.createKey(`${TAGS_VERSIONS_ALIAS}:${tagName}`);
  }

  /**
   * Executes commands from offline queue. Re-queues commands which was not successfully executed.
   */
  private async executeCommandsFromQueue(): Promise<void> {
    if (!this.commandsQueue.length) {
      return;
    }

    const unsuccessfullyExecutedCommands: Command[] = [];

    await Promise.all(this.commandsQueue.map(async ({ fn, params }) => {
      try {
        await fn(...params);
      } catch (executionError) {
        unsuccessfullyExecutedCommands.push({ fn, params });
      }
    }));

    this.commandsQueue = unsuccessfullyExecutedCommands;
  }

  /**
   * All commands wrapped with this method will be "cached". This means that if there are problems with the connection
   * the response will be sent immediately and the command will be executed later when the connection is restored
   * or current execution timed out.
   */
  private async cachedCommand(fn: CommandFn, ...args: any[]): Promise<void> {
    if (!fn) {
      throw new Error('Cached function is required');
    }

    const connectionStatus = this.adapter.getConnectionStatus();

    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      this.queueCommand(fn, args);
    } else {
      try {
        await fn(...args);
      } catch (error) {
        if (isOperationTimeoutError(error)) {
          this.queueCommand(fn, args);
        } else {
          throw error;
        }
      }
    }
  }

  private queueCommand(fn: CommandFn, params: any[]): void {
    this.commandsQueue.push({ fn, params });
  }
}
