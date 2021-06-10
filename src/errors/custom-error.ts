export default function <P>(name: string, message: string, payload: Partial<P> = {}): Error {
  class CacheManagerError extends Error {
    payload: Partial<P>;

    constructor() {
      super();

      this.name = name;
      this.message = message;
      this.payload = payload;
    }
  }

  return new CacheManagerError();
}
