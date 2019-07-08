import createLogger from '../create-logger';
import { BaseManager, ManagerOptions } from './base';
import { Executor, ValueOfExecutor } from '../executor';
import {
  WriteOptions,
  StorageRecord,
  StorageRecordTag,
  StorageRecordValue,
  ReadWriteOptions
} from '../storage';
import deserialize from '../deserialize';

class ReadThroughManager extends BaseManager {
  public static getName(): string {
    return 'read-through';
  }

  constructor(options: ManagerOptions) {
    super({
      ...options,
      logger: createLogger(options.logger, ReadThroughManager.getName())
    });
  }

  public async get<E extends Executor>(key: string, executor: E, options: ReadWriteOptions = {}):
    Promise<ValueOfExecutor<E>> {
    const executorContext = { key, executor, options };
    let record: StorageRecord | null = null;

    try {
      record = await this.storage.get(key);
    } catch (e) {
      this.logger.error('Failed to get value from storage, falling back to executor', e);

      return executor();
    }

    if (await this.isRecordValid(record)) {
      this.logger.trace('hit', key);

      return deserialize((record as any).value);
    }

    this.logger.trace('miss', key);

    return this.updateCacheAndGetResult<E>(executorContext, options);
  }

  public async set(key: string, value: StorageRecordValue, options?: WriteOptions): Promise<any> {
    return this.storage.set(key, value, options);
  }

  private async isRecordValid(record: StorageRecord | null | void): Promise<boolean> {
    const currentDate: number = Date.now();

    if (!record) {
      return false;
    }

    const recordExpireDate = Number(record.createdAt + record.expiresIn) || 0;
    const isExpired = !record.permanent && currentDate > recordExpireDate;

    if (isExpired) {
      return false;
    }

    if (record.tags && record.tags.length) {
      let actualTags: StorageRecordTag[] = [];

      try {
        actualTags = await this.storage.getTags(record.tags.map(tag => tag.name));
      } catch (err) {
        return false;
      }

      if (this.isTagsOutdated(record.tags, actualTags)) {
        return false;
      }
    }

    return record.value !== undefined;
  }
}

export default ReadThroughManager;
