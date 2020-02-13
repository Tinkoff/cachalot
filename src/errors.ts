import customError from './custom-error';
import { ERRORS } from './constants';

export function ParseError(error: Error): Error {
  return customError(ERRORS.ParseError, error.message);
}

export function RequestMaximumTimeoutExceededError(maxTimeout: number, error?: Error): Error {
  const text = `Exceeded maximum timeout of ${maxTimeout}`;

  return customError(ERRORS.RequestMaximumTimeoutExceededError, error ? error.message : text);
}

export function WaitForResultError(error?: Error): Error {
  const text = 'Error while waiting for result in cache';

  return customError(ERRORS.WaitForResultError, error ? error.message : text);
}

export function OperationTimeoutError(timeout: number): Error {
  const text = `Operation timeout after ${timeout}`;

  return customError(ERRORS.OperationTimeoutError, text);
}

export function isOperationTimeoutError(error: any): boolean {
  return error instanceof Error && error.name === ERRORS.OperationTimeoutError;
}
