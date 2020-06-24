import { createHash } from "crypto";
import { ConnectionStatus } from "../ConnectionStatus";
import deserialize from "../deserialize";
import { isOperationTimeoutError } from "../errors/errors";
import { Storage, Tag, WriteOptions } from "./Storage";
import { StorageAdapter } from "../StorageAdapter";
import { Record } from "./Record";
import differenceWith from "lodash/differenceWith";

export const TAGS_VERSIONS_ALIAS = "cache-tags-versions";

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

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
  params: unknown[];
}

/**
 * CommandFn is a function (usually a Storage method bind to its context) which is stored in
 * Command object for further execution.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CommandFn = (...args: any[]) => unknown;

/**
 * BaseStorage is the default Storage implementation for Manager.
 *
 * It provides functionality of get, set, touching tags, locking keys etc.
 * It also manages command execution, supporting an "offline" queue of commands.
 */
export class BaseStorage implements Storage {
  constructor(options: BaseStorageOptions) {
    this.adapter = options.adapter;
    this.tagsAdapter = options.tagsAdapter || options.adapter;
    this.prefix = options.prefix || "";
    this.hashKeys = options.hashKeys || false;

    this.adapter.setOptions?.(options);

    this.adapter.onConnect(async () => this.executeCommandsFromQueue());

    this.setTagVersions = this.setTagVersions.bind(this);
  }

  /**
   * An offline commands queue.
   */
  private commandsQueue: Command[] = [];

  /**
   * The prefix is used to prevent conflicts in the key names of different BaseStorage instances.
   */
  private readonly prefix: string;

  /**
   * Does it affect whether the keys are kept "as is" or they will be hashed. Hashing can be useful
   * for partitioning some databases.
   */
  private readonly hashKeys: boolean;

  /**
   * The adapter is an layer between the underlying storage and the BaseStorage class.
   * Implements the StorageAdapter interface.
   */
  private readonly adapter: StorageAdapter;

  /**
   * Adapter for tags should be provided if your primary adapter uses eviction policy.
   * This adapter should not use any eviction policy. Records should be deleted only by demand or expiration.
   */
  private readonly tagsAdapter: StorageAdapter;

  /**
   * Gets a record using an adapter. It is expected that the adapter returns or null (value not found)
   * or serialized Record.
   */
  public async get<R>(key: string): Promise<Record<R> | null> {
    const value = await this.adapter.get(this.createKey(key));
    if (value == null) {
      return null;
    }

    const record = deserialize<Record<R>>(value);

    if (!Record.isRecord(record)) {
      return null;
    }

    return record;
  }

  /**
   * Creates new set of tag records and updates them.
   */
  public async setTagVersions(tags: Tag[]): Promise<void> {
    const values = new Map(tags.map(tag => [this.createTagKey(tag.name), `${tag.version}`]));
    return this.tagsAdapter.mset(values);
  }

  /**
   * Invalidates tags given as array of strings.
   */
  public async touch(tags: string[]): Promise<void> {
    if (tags.length > 0) {
      await this.cachedCommand(this.setTagVersions.bind(this), tags.map(this.createTag));
    }
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
  public async del(key: string): Promise<boolean> {
    return this.adapter.del(this.createKey(key));
  }

  /**
   * Retrieves actual versions of tags from storage. Tags which was not found in storage will be created with 0
   * version.
   */
  public async getTags(tagNames: string[]): Promise<Tag[]> {
    if (tagNames.length === 0) {
      return [];
    }

    const existingTags = await this.tagsAdapter.mget(tagNames.map(tagName => this.createTagKey(tagName)));

    return tagNames.map((tagName, index) => ({
      name: tagName,
      version: Number(existingTags[index]) || 0,
    }));
  }

  /**
   * set creates new record with provided options and sets it to storage using the adapter.
   */
  public async set<R>(key: string, value: R, options: WriteOptions<R> = {}): Promise<Record<R>> {
    let tags: string[] = [];

    if (Array.isArray(options.tags)) {
      tags = options.tags;
    } else if (options.tags !== undefined) {
      tags = options.tags();
    }

    const dynamicTags = options.getTags?.(value) ?? [];

    if (!Array.isArray(dynamicTags)) {
      throw new TypeError(`getTags should return an array of strings, got ${typeof dynamicTags}`);
    }

    const record = new Record(key, value, uniq(tags.concat(dynamicTags)).map(this.createTag), options);

    await this.adapter.set(
      this.createKey(key),
      JSON.stringify({ ...record, value: JSON.stringify(record.value) }),
      record.expiresIn
    );

    return record;
  }

  /**
   * Checks if record is outdated by tags
   *
   * @param record
   */
  public async isOutdated<R>(record: Record<R>): Promise<boolean> {
    if (record.tags && record.tags.length) {
      let actualTags: Tag[] = [];

      try {
        actualTags = await this.getTags(record.tags.map(tag => tag.name));
      } catch (err) {
        return true;
      }

      const isTagOutdatedComparator = (recordTag: Tag, actualTag: Tag): boolean =>
        recordTag.name === actualTag.name && recordTag.version >= actualTag.version;

      const diff = differenceWith(record.tags, actualTags, isTagOutdatedComparator);

      return diff.length !== 0;
    }

    return false;
  }

  /**
   * Returns current connection status of storage.
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.adapter.getConnectionStatus();
  }

  /**
   * Depending on the option, [hashKeys] generates an MD5 hash "key" for the storage or gives it "as is".
   * The key is generated from the "prefix" of the storage defined at the time of the creation of
   * the BaseStorage instance and identifier passed in the key parameter string.
   */
  private createKey(key: string): string {
    const rawKey = this.prefix ? `${this.prefix}-${key}` : key;

    return this.hashKeys
      ? createHash("md5")
          .update(rawKey)
          .digest("hex")
      : rawKey;
  }

  private createTagKey(tagName: string): string {
    return this.createKey(`${TAGS_VERSIONS_ALIAS}:${tagName}`);
  }

  private createTag(tagName: string): Tag {
    return {
      name: tagName,
      version: Date.now(),
    };
  }

  /**
   * Executes commands from offline queue. Re-queues commands which was not successfully executed.
   */
  private async executeCommandsFromQueue(): Promise<void> {
    if (!this.commandsQueue.length) {
      return;
    }

    const unsuccessfullyExecutedCommands: Command[] = [];

    await Promise.all(
      this.commandsQueue.map(async ({ fn, params }) => {
        try {
          await fn(...params);
        } catch (executionError) {
          unsuccessfullyExecutedCommands.push({ fn, params });
        }
      })
    );

    this.commandsQueue = unsuccessfullyExecutedCommands;
  }

  /**
   * All commands wrapped with this method will be "cached". This means that if there are problems with the connection
   * the response will be sent immediately and the command will be executed later when the connection is restored
   * or current execution timed out.
   */
  private async cachedCommand(fn: CommandFn, ...args: unknown[]): Promise<void> {
    if (!fn) {
      throw new Error("Cached function is required");
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

  private queueCommand(fn: CommandFn, params: unknown[]): void {
    this.commandsQueue.push({ fn, params });
  }
}
