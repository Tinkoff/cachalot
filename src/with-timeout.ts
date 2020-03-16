import { OperationTimeoutError } from "./errors";

export const withTimeout = async <T>(promise: Promise<T>, timeout: number): Promise<T> => {
    const timeoutPromise = new Promise<never>((resolveTimeout, rejectTimeout): void => {
    setTimeout(() => {
      rejectTimeout(OperationTimeoutError(timeout));
    }, timeout);
  });

  return Promise.race([timeoutPromise, promise]);
};
