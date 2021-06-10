import * as errors from "./errors/errors";

export default function <R>(value: string): R {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw errors.parseError(error);
  }
}
