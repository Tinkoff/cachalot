import { BaseManager, ManagerOptions } from "./BaseManager";
import { Executor, runExecutor } from "../Executor";
import { WriteOptions, ReadWriteOptions } from "../storage/Storage";
import { Record } from "../storage/Record";
import deserialize from "../deserialize";

class ReadThroughManager extends BaseManager {
  public static getName(): string {
    return "read-through";
  }

  constructor(options: ManagerOptions) {
    super(options);
  }

  public async get<R>(key: string, executor: Executor<R>, options: ReadWriteOptions<R> = {}): Promise<R> {
    let record: Record<string> | null = null;

    try {
      record = await this.storage.get(key);
    } catch (e) {
      this.logger.error("Failed to get value from storage, falling back to executor", e);

      return runExecutor(executor);
    }

    if (this.isRecordValid(record) && !(await this.storage.isOutdated(record))) {
      return deserialize(record.value);
    }

    const executorContext = { key, executor, options };
    return this.updateCacheAndGetResult(executorContext, options);
  }

  public async set<R>(key: string, value: R, options?: WriteOptions<R>): Promise<Record<R>> {
    return this.storage.set(key, value, options);
  }

  private isRecordValid<R>(record: Record<R> | null | undefined): record is Record<R> {
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
}

export default ReadThroughManager;
