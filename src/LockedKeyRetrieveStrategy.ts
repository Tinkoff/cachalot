import { ExecutorContext } from "./Executor";

/**
 * It is possible (for descendants of BaseManager) to change the behavior of getting
 * updated results. For example if you deal with heavy queries to DB you probably want
 * to run one query at once forcing other consumers to wait for results in cache.
 */
export interface LockedKeyRetrieveStrategy {
  getName(): string;
  get<R = any>(context: ExecutorContext): Promise<R>;
}

export enum LockedKeyRetrieveStrategyTypes {
  waitForResult = "waitForResult",
  runExecutor = "runExecutor",
}

export type LockedKeyRetrieveStrategyType = keyof typeof LockedKeyRetrieveStrategyTypes;
