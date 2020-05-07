import { operationTimeoutError } from "./errors/errors";

export const withTimeout = async <T>(promise: Promise<T>, timeout: number): Promise<T> => {
  const timeoutPromise = new Promise<never>((resolveTimeout, rejectTimeout): void => {
    setTimeout(() => {
      rejectTimeout(operationTimeoutError(timeout));
    }, timeout);
  });

  return Promise.race([timeoutPromise, promise]);
};
