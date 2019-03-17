import { Executor, ValueOfExecutor } from './executor';
import { WriteOptions, StorageRecordValue, ReadWriteOptions } from './storage';

/**
 * Manager is the basic interface for all caching classes. Manager must implement
 * two simple methods - get, and set. Cache class will delegate it's get and set calls to manager
 * which must decide what record should be threaten as invalid, when and how to update record
 */
export interface Manager {
  get<E extends Executor>(key: string, executor: E, options: ReadWriteOptions): Promise<ValueOfExecutor<E>>;
  set(key: string, value: StorageRecordValue, options?: WriteOptions): Promise<any>;
}
