import { LockedKeyRetrieveStrategy } from '../locked-key-retrieve-strategy';
import { ExecutorContext } from '../executor';

/**
 * This locked key retrieve strategy is default and suitable for most cases. It just
 * runs executor and returns value from it.
 */
export class RunExecutorLockedKeyRetrieveStrategy implements LockedKeyRetrieveStrategy {
  public getName(): string {
    return 'runExecutor';
  }

  async get(context: ExecutorContext): Promise<any> {
    return context.executor();
  }
}
