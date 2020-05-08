import { BaseManager, ManagerOptions } from "./BaseManager";
import { Executor, runExecutor } from "../Executor";
import { ReadWriteOptions, WriteOptions } from "../storage/Storage";
import { Record } from "../storage/Record";
import deserialize from "../deserialize";

class WriteThroughManager extends BaseManager {
  public static getName(): string {
    return "write-through";
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

    if (this.isRecordValid(record)) {
      this.logger.trace("hit", key);

      return deserialize<R>(record.value);
    }

    this.logger.trace("miss", key);

    const executorContext = { key, executor, options };
    return this.updateCacheAndGetResult(executorContext, options);
  }

  public async set<R>(key: string, value: R, options?: WriteOptions<R>): Promise<Record<R>> {
    return this.storage.set(key, value, { ...options, permanent: true });
  }

  private isRecordValid<R>(record: Record<R> | null | void): record is Record<R> {
    if (!record) {
      return false;
    }

    return record.value !== undefined;
  }
}

export default WriteThroughManager;
