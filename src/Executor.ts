import { ReadWriteOptions } from "./storage/Storage";
import { Record } from "./storage/Record";

export interface ExecutorContext<R> {
  key: string;
  executor: Executor<R>;
  options: ReadWriteOptions;
  record?: Record<R>;
}

export type Executor<R> = (...args: unknown[]) => Promise<R> | R;
