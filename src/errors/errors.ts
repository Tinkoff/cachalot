import customError from "./custom-error";
import { ERRORS } from "./constants";

export function parseError(error: Error): Error {
  return customError(ERRORS.ParseError, error.message);
}

export function requestMaximumTimeoutExceededError(maxTimeout: number, error?: Error): Error {
  const text = `Exceeded maximum timeout of ${maxTimeout}`;

  return customError(ERRORS.RequestMaximumTimeoutExceededError, error ? error.message : text);
}

export function waitForResultError(error?: Error): Error {
  const text = "Error while waiting for result in cache";

  return customError(ERRORS.WaitForResultError, error ? error.message : text);
}

export function operationTimeoutError(timeout: number): Error {
  const text = `Operation timeout after ${timeout}`;

  return customError(ERRORS.OperationTimeoutError, text);
}

export function isOperationTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === ERRORS.OperationTimeoutError;
}

export function executorReturnsUndefinedError(): Error {
  const text = "Executor should not return undefined. Correct value for emptiness is null.";

  return customError(ERRORS.ExecutorReturnsUndefinedError, text);
}
