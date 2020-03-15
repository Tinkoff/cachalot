import { BaseManager, ManagerOptions } from "./BaseManager";
import { Executor, ValueOfExecutor } from "../Executor";
import { ReadWriteOptions, WriteOptions, RecordValue } from "../storage/Storage";
import { Record } from "../storage/Record";
import deserialize from "../deserialize";

class WriteThroughManager extends BaseManager {
  public static getName(): string {
    return "write-through";
  }

  constructor(options: ManagerOptions) {
    super(options);
  }

  public async get<E extends Executor>(
    key: string,
    executor: E,
    options: ReadWriteOptions = {}
  ): Promise<ValueOfExecutor<E>> {
    let record: Record | null = null;

    try {
      record = await this.storage.get(key);
    } catch (e) {
      this.logger.error("Failed to get value from storage, falling back to executor", e);

      return executor();
    }

    const executorContext = { key, executor, options };

    if (await this.isRecordValid(record)) {
      this.logger.trace("hit", key);

      return deserialize((record as any).value);
    }

    this.logger.trace("miss", key);

    return this.updateCacheAndGetResult<E>(executorContext, options);
  }

  public async set(key: string, value: RecordValue, options?: WriteOptions): Promise<any> {
    return this.storage.set(key, value, { ...options, permanent: true });
  }

  private async isRecordValid(record: Record | null | void): Promise<boolean> {
    if (!record) {
      return false;
    }

    return record.value !== undefined;
  }
}

export default WriteThroughManager;
