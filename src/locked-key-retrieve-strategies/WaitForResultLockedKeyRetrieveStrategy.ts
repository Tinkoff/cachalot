import { LockedKeyRetrieveStrategy } from "../LockedKeyRetrieveStrategy";
import * as errors from "../errors/errors";
import deserialize from "../deserialize";
import timeout from "../timeout";
import { ExecutorContext } from "../Executor";
import { Logger } from "../Logger";
import { Record } from "../storage/Record";

export const DEFAULT_MAXIMUM_TIMEOUT = 3000;
export const DEFAULT_REQUEST_TIMEOUT = 250;

export type KeyLockCheckFn = (key: string) => boolean | Promise<boolean>;
export type GetRecordFn = <R>(key: string) => Promise<Record<R> | null>;
export type WaitForResultLockedKeyRetrieveStrategyOptions = {
  maximumTimeout?: number;
  requestTimeout?: number;
  keyLockCheckFn: KeyLockCheckFn;
  getRecord: GetRecordFn;
  logger: Logger;
};

/**
 * This locked key retrieve strategy used for prevent consumers getting non-valid or expired values
 * from storage. It holds consumers and not returning result until it appear in storage.
 * Due to complexity of this flow it is not recommended to use it, unless executor is not running
 * big and long query
 */
export class WaitForResultLockedKeyRetrieveStrategy implements LockedKeyRetrieveStrategy {
  constructor(options: WaitForResultLockedKeyRetrieveStrategyOptions) {
    this.maximumTimeout = Number(options.maximumTimeout) || DEFAULT_MAXIMUM_TIMEOUT;
    this.requestTimeout = Number(options.requestTimeout) || DEFAULT_REQUEST_TIMEOUT;
    this.keyIsLocked = options.keyLockCheckFn;
    this.getRecord = options.getRecord;
    this.logger = options.logger;
  }

  private readonly maximumTimeout: number;
  private readonly requestTimeout: number;
  private readonly keyIsLocked: KeyLockCheckFn;
  private readonly getRecord: GetRecordFn;
  private logger: Logger;

  public getName(): string {
    return "waitForResult";
  }

  public async get<R>(context: ExecutorContext<R>): Promise<R> {
    const startTime = Date.now();
    const retryRequest = async (): Promise<R> => {
      if (Date.now() < startTime + this.maximumTimeout) {
        const isLocked = await this.keyIsLocked(context.key);

        if (!isLocked) {
          const rec = await this.getRecord<string>(context.key);

          switch (rec) {
            case null:
            case undefined:
              throw errors.waitForResultError();
            default:
              return deserialize<R>(rec.value);
          }
        }

        await timeout(this.requestTimeout);

        return retryRequest();
      }

      this.logger.error(`Key "${context.key}" is locked more than allowed ${this.maximumTimeout}ms.`);

      throw errors.requestMaximumTimeoutExceededError(this.maximumTimeout);
    };

    return retryRequest();
  }
}
