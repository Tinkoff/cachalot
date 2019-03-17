import { ReadWriteOptions, StorageRecord } from './storage';

export interface ExecutorContext {
  key: string;
  executor: Executor;
  options: ReadWriteOptions;
  record?: StorageRecord;
}

export type ValueOfExecutor<V extends Executor> = ReturnType<V> extends Promise<infer RT> ? RT : V;
export type Executor = (...args: any[]) => Promise<any> | any;
