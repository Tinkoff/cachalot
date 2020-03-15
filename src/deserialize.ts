import * as errors from "./errors";

export default function(value: any): any {
  if (value === undefined) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw errors.ParseError(error);
  }
}
