import { BaseManager, ManagerOptions } from './base';
import { Executor, ExecutorContext, ValueOfExecutor } from '../executor';
import {
  WriteOptions,
  StorageRecord,
  StorageRecordTag,
  StorageRecordValue,
  ReadWriteOptions
} from '../storage';
import deserialize from '../deserialize';
import createLogger from '../create-logger';

export const DEFAULT_REFRESH_AHEAD_FACTOR = 0.8;

export interface RefreshAheadManagerOptions extends ManagerOptions {
  refreshAheadFactor?: number;
}

class RefreshAheadManager extends BaseManager {
  public static getName(): string {
    return 'refresh-ahead';
  }

  constructor(options: RefreshAheadManagerOptions) {
    super({
      ...options,
      logger: createLogger(options.logger, RefreshAheadManager.getName())
    });

    this.refreshAheadFactor = options.refreshAheadFactor || DEFAULT_REFRESH_AHEAD_FACTOR;

    if (isFinite(Number(this.refreshAheadFactor))) {
      if (this.refreshAheadFactor <= 0) {
        throw new Error('Refresh-Ahead factor should be more than 0');
      }

      if (this.refreshAheadFactor >= 1) {
        throw new Error('Refresh-Ahead factor should be under 1');
      }
    }
  }

  private refreshAheadFactor: number;

  public async get<E extends Executor>(key: string, executor: E, options: ReadWriteOptions = {}):
    Promise<ValueOfExecutor<E>> {
    const executorContext = { key, executor, options };
    const record = await this.storage.get(key);

    if (await this.isRecordValid(record)) {
      const result = deserialize((record as any).value);

      this.logger.trace('hit', key);

      if (this.isRecordExpireSoon(record)) {
        this.refresh(key, executorContext, options)
          .catch(err => this.logger.error(err));
      }

      return result;
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

  private isRecordExpireSoon(record: StorageRecord | null): boolean {
    const currentDate: number = Date.now();

    if (!record) {
      return false;
    }

    const recordExpireDate = Number(record.createdAt + (record.expiresIn * this.refreshAheadFactor)) || 0;

    return !record.permanent && currentDate > recordExpireDate;
  }

  private async refresh(key: string, context: ExecutorContext, options: WriteOptions): Promise<void> {
    const refreshAheadKey = `refreshAhead:${key}`;
    const isExecutorLockSuccessful = await this.storage.lockKey(refreshAheadKey);

    if (isExecutorLockSuccessful) {
      try {
        this.logger.trace(`refresh "${key}"`);

        const executorResult = await context.executor();

        await this.storage.set(key, executorResult, options);
      } catch (e) {
        this.logger.error(e);
      } finally {
        await this.storage.releaseKey(refreshAheadKey);
      }
    }
  }
}

export default RefreshAheadManager;
