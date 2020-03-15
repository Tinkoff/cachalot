export default function(name: string, message: string, payload: any = {}): Error {
  class CacheManagerError extends Error {
    payload: any;

    constructor() {
      super();

      this.name = name;
      this.message = message;
      this.payload = payload;
    }
  }

  return new CacheManagerError();
}
