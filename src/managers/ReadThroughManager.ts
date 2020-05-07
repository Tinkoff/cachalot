import { Manager } from "../Manager";
import { BaseManager, ManagerOptions } from "./BaseManager";
import { Executor } from "../Executor";
import { WriteOptions, ReadWriteOptions } from "../storage/Storage";
import { Record, RecordWithValue } from "../storage/Record";
import deserialize from "../deserialize";

class ReadThroughManager extends BaseManager implements Manager {
  public static getName(): string {
    return "read-through";
  }

  constructor(options: ManagerOptions) {
    super(options);
  }

  public async get<E extends Executor<R>, R>(
    key: string,
    executor: E,
    options: ReadWriteOptions = {}
  ): Promise<R | undefined> {
    const executorContext = { key, executor, options };
    let record: Record<string> | null = null;

    try {
      record = await this.storage.get<string>(key);
    } catch (e) {
      this.logger.error("Failed to get value from storage, falling back to executor", e);

      return executor();
    }

    if (this.isRecordValid(record) && !(await this.storage.isOutdated(record))) {
      return deserialize(record.value);
    }

    return this.updateCacheAndGetResult<E, R>(executorContext, options);
  }

  public async set<R>(key: string, value: R, options?: WriteOptions): Promise<Record<R>> {
    return this.storage.set(key, value, options);
  }

  private isRecordValid<R>(record: Record<R> | null | undefined): record is RecordWithValue<R> {
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
