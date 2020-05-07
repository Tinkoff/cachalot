import { Manager } from "../Manager";
import { BaseManager, ManagerOptions } from "./BaseManager";
import { Executor, ExecutorContext } from "../Executor";
import { WriteOptions, ReadWriteOptions } from "../storage/Storage";
import { Record, RecordWithValue } from "../storage/Record";
import deserialize from "../deserialize";

export const DEFAULT_REFRESH_AHEAD_FACTOR = 0.8;

export interface RefreshAheadManagerOptions extends ManagerOptions {
  refreshAheadFactor?: number;
}

class RefreshAheadManager extends BaseManager implements Manager {
  public static getName(): string {
    return "refresh-ahead";
  }

  constructor(options: RefreshAheadManagerOptions) {
    super(options);

    this.refreshAheadFactor = options.refreshAheadFactor || DEFAULT_REFRESH_AHEAD_FACTOR;

    if (isFinite(Number(this.refreshAheadFactor))) {
      if (this.refreshAheadFactor <= 0) {
        throw new Error("Refresh-Ahead factor should be more than 0");
      }

      if (this.refreshAheadFactor >= 1) {
        throw new Error("Refresh-Ahead factor should be under 1");
      }
    }
  }

  private readonly refreshAheadFactor: number;

  public async get<E extends Executor<R>, R>(
    key: string,
    executor: E,
    options: ReadWriteOptions = {}
  ): Promise<R | undefined> {
    const executorContext = { key, executor, options };
    let record: Record<string> | null = null;

    try {
      record = await this.storage.get(key);
    } catch (e) {
      this.logger.error("Failed to get value from storage, falling back to executor", e);

      return executor();
    }

    if (this.isRecordValid(record) && !(await this.storage.isOutdated(record))) {
      const result = deserialize<R>(record.value);

      if (this.isRecordExpireSoon(record)) {
        this.refresh(key, executorContext, options).catch(err => this.logger.error(err));
      }

      return result;
    }

    return this.updateCacheAndGetResult<E, R>(executorContext, options);
  }

  public async set<R>(key: string, value: R, options?: WriteOptions): Promise<Record<R>> {
    return this.storage.set(key, value, options);
  }

  private isRecordValid<R>(record: Record<R> | null | void): record is RecordWithValue<R> {
    const currentDate: number = Date.now();

    if (!record) {
      return false;
    }

    const recordExpireDate = Number(record.createdAt + record.expiresIn) || 0;
    const isExpired = !record.permanent && currentDate > recordExpireDate;

    if (isExpired) {
      return false;
    }

    return record.value !== undefined;
  }

  private isRecordExpireSoon<R>(record: Record<R> | null): boolean {
    const currentDate: number = Date.now();

    if (!record) {
      return false;
    }

    const recordExpireDate = Number(record.createdAt + record.expiresIn * this.refreshAheadFactor) || 0;

    return !record.permanent && currentDate > recordExpireDate;
  }

  private async refresh<R>(key: string, context: ExecutorContext<R>, options: WriteOptions): Promise<void> {
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
