import differenceWith from 'lodash/differenceWith';
import { Manager } from '../manager';
import {
  ExpireOptions,
  WriteOptions,
  Storage,
  StorageRecordTag,
  StorageRecordValue, ReadWriteOptions
} from '../storage';
import { LockedKeyRetrieveStrategy, LockedKeyRetrieveStrategyTypes } from '../locked-key-retrieve-strategy';
import { Logger } from '../logger';
import { WaitForResultLockedKeyRetrieveStrategy } from '../locked-key-retrieve-strategies/wait-for-result';
import { RunExecutorLockedKeyRetrieveStrategy } from '../locked-key-retrieve-strategies/run-executor';
import { Executor, ExecutorContext, ValueOfExecutor } from '../executor';

export interface ManagerOptions extends ExpireOptions {
  prefix?: string;
  hashKeys?: boolean;
  logger: Logger;
  storage: Storage;
  refreshAheadFactor?: number;
  lockedKeyRetrieveStrategies?: [string, LockedKeyRetrieveStrategy][];
}

export abstract class BaseManager implements Manager {
  constructor(options: ManagerOptions) {
    this.logger = options.logger;
    this.storage = options.storage;
    this.lockedKeyRetrieveStrategies = new Map([
      [LockedKeyRetrieveStrategyTypes.waitForResult, new WaitForResultLockedKeyRetrieveStrategy({
        keyLockCheckFn: this.storage.keyIsLocked.bind(this),
        getRecord: this.storage.get.bind(this),
        logger: this.logger
      })],
      [LockedKeyRetrieveStrategyTypes.runExecutor, new RunExecutorLockedKeyRetrieveStrategy()]
    ]);

    if (Array.isArray(options.lockedKeyRetrieveStrategies)) {
      options.lockedKeyRetrieveStrategies.forEach(([name, strategy]) => {
        this.lockedKeyRetrieveStrategies.set(name, strategy);
      });
    }
  }

  protected storage: Storage;

  protected lockedKeyRetrieveStrategies: Map<string, LockedKeyRetrieveStrategy>;

  protected logger: Logger;

  public abstract get<E extends Executor>(key: string, executor: E, options: ReadWriteOptions):
    Promise<ValueOfExecutor<E>>;

  public abstract set(key: string, value: StorageRecordValue, options?: WriteOptions): Promise<any>;

  protected isTagsOutdated = (recordArrayTags: StorageRecordTag[], actualArrayTags: StorageRecordTag[]): boolean => {
    const isTagOutdatedComparator = (recordTag: StorageRecordTag, actualTag: StorageRecordTag): boolean =>
      recordTag.name === actualTag.name && recordTag.version >= actualTag.version;

    return differenceWith(recordArrayTags, actualArrayTags, isTagOutdatedComparator).length !== 0;
  }

  protected async updateCacheAndGetResult<E extends Executor>(context: ExecutorContext, options: ReadWriteOptions):
    Promise<ValueOfExecutor<E>> {
    const lockedKeyRetrieveStrategy = this.getLockedKeyRetrieveStrategy(options.lockedKeyRetrieveStrategyType);
    let isKeySuccessfullyLocked = false;

    try {
      isKeySuccessfullyLocked = await this.storage.lockKey(context.key);
    } catch (keyLockError) {
      this.logger.error(`Error occurred while trying to lock key "${context.key}". Reason: ${keyLockError.message}. Running executor`);

      return context.executor();
    }

    if (!isKeySuccessfullyLocked) {
      return lockedKeyRetrieveStrategy.get(context);
    }

    try {
      this.logger.trace(`Running executor for key "${context.key}"`);
      const executorResult = await context.executor();

      await this.set(context.key, executorResult, options);

      return executorResult;
    } finally {
      await this.storage.releaseKey(context.key);
    }
  }

  protected getLockedKeyRetrieveStrategy(strategyName: string = LockedKeyRetrieveStrategyTypes.runExecutor): LockedKeyRetrieveStrategy {
    const strategy = this.lockedKeyRetrieveStrategies.get(strategyName);

    if (!strategy) {
      throw new Error(`Cannot find "${strategyName}" locked key retrieve strategy`);
    }

    return strategy;
  }
}
