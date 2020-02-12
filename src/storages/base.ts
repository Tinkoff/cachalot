import { createHash } from 'crypto';
import isFunction from 'lodash/isFunction';
import uniq from 'lodash/uniq';
import { ConnectionStatus } from '../connection-status';
import deserialize from '../deserialize';
import createRecord from '../record';
import createTag from '../record/create-tag';
import serialize from '../serialize';
import { Storage, StorageRecord, StorageRecordTag, StorageRecordValue, WriteOptions } from '../storage';
import { StorageAdapter } from '../storage-adapter';

export const TAGS_VERSIONS_ALIAS = 'cache-tags-versions';

export const NOT_TOUCHED_TAGS_CACHE_KEY = 'not-touched-tags';

const NON_EXISTING_TAG_VERSION = 0;

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
  params: any;
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
  public async setTagVersions(tags: StorageRecordTag[]): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    const values = new Map(tags.map(tag => [this.createTagKey(tag.name), `${tag.version}`]));
    return this.tagsAdapter.mset(values);
  }

  /**
   * Invalidates tags given as array of strings.
   *
   * See [diagram](media://images/not-touched-tags-optimization/touch.png)
   */
  public async touch(tags: string[]): Promise<void> {
    await Promise.all([
      this.cachedCommand(this.setTagVersions.bind(this), tags.map(tag => createTag(tag))),
      this.cachedCommand(this.deleteNotTouchedTags.bind(this), tags)
    ]);
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
   * Retrieves actual versions of tags from storage.
   * Optimization used: first filter tag names with not touched tags set.
   * Tags which was not found in storage will be created with 0 version.
   *
   * See [diagram](media://images/not-touched-tags-optimization/get_tags.png)
   */
  public async getTags(tagNames: string[]): Promise<StorageRecordTag[]> {
    const notTouchedTags = await this.filterNotTouchedTags(tagNames);
    const tags: StorageRecordTag[] = [];
    notTouchedTags.forEach(name => tags.push(createTag(name, NON_EXISTING_TAG_VERSION)));

    const tagsToRequest = tagNames.filter(name => !notTouchedTags.has(name));
    const existingTags = await this.getActualTags(tagsToRequest);

    return tags.concat(existingTags);
  }

  /**
   * set creates new record with provided options and sets it to storage using the adapter.
   *
   * See [diagram](media://images/not-touched-tags-optimization/touch.png)
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

    const record = createRecord(key, value, uniq(tags.concat(dynamicTags)).map(tag => createTag(tag)), options);

    await this.saveNotTouchedTags(record.tags);

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
  private async executeCommandsFromQueue(): Promise<any> {
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
   * the response will be sent immediately and the command will be executed later when the connection is restored.
   */
  private async cachedCommand(fn: CommandFn, ...args: any[]): Promise<void> {
    if (!fn) {
      throw new Error('Cached function is required');
    }

    const connectionStatus = this.adapter.getConnectionStatus();

    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      this.commandsQueue.push({
        fn,
        params: args
      });
    } else {
      await fn(...args);
    }
  }

  /**
   * Saves only new not touched tags in tag storage.
   */
  private async saveNotTouchedTags(recordTags: StorageRecordTag[]): Promise<void> {
    const allTags = recordTags.map(tag => tag.name);
    const notTouchedTags = await this.filterNotTouchedTags(allTags);
    const unknownTags = allTags.filter(tag => !notTouchedTags.has(tag));

    const gotTags = await this.getActualTags(unknownTags);
    const nonExistingTags = gotTags.filter(tag => tag.version === NON_EXISTING_TAG_VERSION);

    await this.addNotTouchedTags(nonExistingTags.map(tag => tag.name));
  }

  /**
   * Gets actual tags from storage.
   * It only searches tags stored as separate records.
   */
  private async getActualTags(tagNames: string[]): Promise<StorageRecordTag[]> {
    if (tagNames.length === 0) {
      return [];
    }
    const tags = await this.tagsAdapter.mget(tagNames.map(tagName => this.createTagKey(tagName)));

    return tagNames.map((tagName, index) => createTag(tagName, Number(tags[index]) || NON_EXISTING_TAG_VERSION));
  }

  /**
   * Adds specified tags into not touched tags special set
   */
  private async addNotTouchedTags(tags: string[]): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    return this.tagsAdapter.addToSet(NOT_TOUCHED_TAGS_CACHE_KEY, tags);
  }

  /**
   * Deletes specified tags from not touched tags special set
   */
  private async deleteNotTouchedTags(tags: string[]): Promise<void> {
    return this.tagsAdapter.deleteFromSet(NOT_TOUCHED_TAGS_CACHE_KEY, tags);
  }

  /**
   * Filter specified tags with not touched tags special set.
   * In other words it returns intersection of specified tags and special tags set in storage.
   */
  private async filterNotTouchedTags(tags: string[]): Promise<Set<string>> {
    if (tags.length === 0) {
      return new Set([]);
    }

    return this.tagsAdapter.intersectWithSet(NOT_TOUCHED_TAGS_CACHE_KEY, tags);
  }
}
