import { executorReturnsUndefinedError } from "./errors/errors";
import { ReadWriteOptions } from "./storage/Storage";
import { Record } from "./storage/Record";

export interface ExecutorContext<R> {
  key: string;
  executor: Executor<R>;
  options: ReadWriteOptions<R>;
  record?: Record<R>;
}

type NonUndefined<T> = T extends undefined ? never : T;

export async function runExecutor<R>(executor: Executor<R>): Promise<R> {
  const result = await executor();

  if (result === undefined) {
    throw executorReturnsUndefinedError();
  }

  return result;
}

export type Executor<R> = (...args: unknown[]) => Promise<NonUndefined<R>> | NonUndefined<R>;
