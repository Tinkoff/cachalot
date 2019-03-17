import { LockedKeyRetrieveStrategy } from '../locked-key-retrieve-strategy';
import * as errors from '../errors';
import deserialize from '../deserialize';
import timeout from '../timeout';
import { ExecutorContext } from '../executor';
import { Logger } from '../logger';
import { StorageRecord } from '../storage';

export const DEFAULT_MAXIMUM_TIMEOUT = 3000;
export const DEFAULT_REQUEST_TIMEOUT = 250;

export type KeyLockCheckFn = (key: string) => boolean | Promise<boolean>;
export type GetRecordFn  = (key: string) => Promise<any>;
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

  private maximumTimeout: number;
  private requestTimeout: number;
  private keyIsLocked: KeyLockCheckFn;
  private getRecord: GetRecordFn;
  private logger: Logger;

  public getName(): string {
    return 'waitForResult';
  }

  public async get(context: ExecutorContext): Promise<any> {
    const startTime = Date.now();
    const retryRequest = async (): Promise<any> => {
      if (Date.now() < startTime + this.maximumTimeout) {
        const isLocked = await this.keyIsLocked(context.key);

        if (!isLocked) {
          const rec: StorageRecord | null = await this.getRecord(context.key);

          switch (rec) {
            case null:
            case undefined:
              throw errors.WaitForResultError();
            default:
              return deserialize(rec.value);
          }
        }

        await timeout(this.requestTimeout);

        return retryRequest();
      }

      this.logger.error(`Key "${context.key}" is locked more than allowed ${this.maximumTimeout}ms.`);

      throw errors.RequestMaximumTimeoutExceededError(this.maximumTimeout);
    };

    return retryRequest();
  }
}
