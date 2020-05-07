import { Executor } from "./Executor";
import { WriteOptions, ReadWriteOptions } from "./storage/Storage";
import { Record } from "./storage/Record";

/**
 * Manager is the basic interface for all caching classes. Manager must implement
 * two simple methods - get, and set. Cache class will delegate it's get and set calls to manager
 * which must decide what record should be threaten as invalid, when and how to update record
 */
export interface Manager {
  get<E extends Executor<R>, R>(key: string, executor: E, options: ReadWriteOptions): Promise<R | undefined>;
  set<R>(key: string, value: R, options?: WriteOptions): Promise<Record<R>>;
}
