import { Executor } from "./Executor";
import { WriteOptions, ReadWriteOptions } from "./storage/Storage";
import { Record } from "./storage/Record";

/**
 * Manager is the basic interface for all caching classes. Manager must implement
 * two simple methods - get, and set. Cache class will delegate it's get and set calls to manager
 * which must decide what record should be threaten as invalid, when and how to update record
 */
export interface Manager {
  get<R>(key: string, executor: Executor<R>, options: ReadWriteOptions<R>): Promise<R>;
  set<R>(key: string, value: R, options?: WriteOptions<R>): Promise<Record<R>>;
}
