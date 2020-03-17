import { BaseManager, ManagerOptions } from "./BaseManager";
import { Executor, ValueOfExecutor } from "../Executor";
import { WriteOptions, ReadWriteOptions } from "../storage/Storage";
import { Record, RecordValue } from "../storage/Record";
import deserialize from "../deserialize";

class ReadThroughManager extends BaseManager {
  public static getName(): string {
    return "read-through";
  }

  constructor(options: ManagerOptions) {
    super(options);
  }

  public async get<E extends Executor>(
    key: string,
    executor: E,
    options: ReadWriteOptions = {}
  ): Promise<ValueOfExecutor<E>> {
    const executorContext = { key, executor, options };
    let record: Record | null = null;

    try {
      record = await this.storage.get(key);
    } catch (e) {
      this.logger.error("Failed to get value from storage, falling back to executor", e);

      return executor();
    }

    if (this.isRecordValid(record) && !(await this.storage.isOutdated(record))) {
      return deserialize(record.value);
    }

    return this.updateCacheAndGetResult<E>(executorContext, options);
  }

  public async set(key: string, value: RecordValue, options?: WriteOptions): Promise<Record> {
    return this.storage.set(key, value, options);
  }

  private isRecordValid(record: Record | null | void): record is Record {
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
