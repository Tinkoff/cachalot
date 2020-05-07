import { BaseManager, ManagerOptions } from "./BaseManager";
import { Executor } from "../Executor";
import { ReadWriteOptions, WriteOptions } from "../storage/Storage";
import { Record, RecordWithValue } from "../storage/Record";
import deserialize from "../deserialize";
import { Manager } from "../Manager";

class WriteThroughManager extends BaseManager implements Manager {
  public static getName(): string {
    return "write-through";
  }

  constructor(options: ManagerOptions) {
    super(options);
  }

  public async get<E extends Executor<R>, R>(
    key: string,
    executor: E,
    options: ReadWriteOptions = {}
  ): Promise<R | undefined> {
    let record: Record<string> | null = null;

    try {
      record = await this.storage.get(key);
    } catch (e) {
      this.logger.error("Failed to get value from storage, falling back to executor", e);

      return executor();
    }

    const executorContext = { key, executor, options };

    if (this.isRecordValid(record)) {
      this.logger.trace("hit", key);

      return deserialize<R>(record.value);
    }

    this.logger.trace("miss", key);

    return this.updateCacheAndGetResult<E, R>(executorContext, options);
  }

  public async set<R>(key: string, value: R, options?: WriteOptions): Promise<Record<R>> {
    return this.storage.set(key, value, { ...options, permanent: true });
  }

  private isRecordValid<R>(record: Record<R> | null | void): record is RecordWithValue<R> {
    if (!record) {
      return false;
    }

    return record.value !== undefined;
  }
}

export default WriteThroughManager;
