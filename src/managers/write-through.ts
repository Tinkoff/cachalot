import { BaseManager, ManagerOptions } from './base';
import { Executor, ValueOfExecutor } from '../executor';
import { ReadWriteOptions, WriteOptions, StorageRecordValue, StorageRecord } from '../storage';
import deserialize from '../deserialize';
import createLogger from '../create-logger';

class WriteThroughManager extends BaseManager {
  public static getName(): string {
    return 'write-through';
  }

  constructor(options: ManagerOptions) {
    super({
      ...options,
      logger: createLogger(options.logger, WriteThroughManager.getName())
    });
  }

  public async get<E extends Executor>(key: string, executor: E, options: ReadWriteOptions = {}): Promise<ValueOfExecutor<E>> {
    const record = await this.storage.get(key);
    const executorContext = { key, executor, options };

    if (await this.isRecordValid(record)) {
      this.logger.trace('hit', key);

      return deserialize((record as any).value);
    }

    this.logger.trace('miss', key);

    return this.updateCacheAndGetResult<E>(executorContext, options);
  }

  public async set(key: string, value: StorageRecordValue, options?: WriteOptions): Promise<any> {
    return this.storage.set(key, value, { ...options, permanent: true });
  }

  private async isRecordValid(record: StorageRecord | null | void): Promise<boolean> {
    if (!record) {
      return false;
    }

    return record.value !== undefined;
  }
}

export default WriteThroughManager;
