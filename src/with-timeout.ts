import { OperationTimeoutError } from './errors';

export const withTimeout = async (promise: Promise<any>, timeout: number): Promise<any> => {
  const timeoutPromise = new Promise((resolveTimeout, rejectTimeout): void => {
    setTimeout(() => {
      rejectTimeout(OperationTimeoutError(timeout));
    }, timeout);
  });

  return Promise.race([timeoutPromise, promise]);
};
