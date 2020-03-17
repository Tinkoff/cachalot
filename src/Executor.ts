import { ReadWriteOptions } from "./storage/Storage";
import { Record } from "./storage/Record";

export interface ExecutorContext {
  key: string;
  executor: Executor;
  options: ReadWriteOptions;
  record?: Record;
}

export type ValueOfExecutor<V extends Executor> = ReturnType<V> extends Promise<infer RT> ? RT : V;
export type Executor = (...args: any[]) => Promise<any> | any;
