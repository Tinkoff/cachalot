import { Tag, WriteOptions } from "./Storage";

export class Record<R> {
  /**
   * Checks if provided value is valid Record.
   */
  static isRecord(value: unknown): value is Record<unknown> {
    return typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "key");
  }
  /**
   * Record key
   */
  key: string;
  /**
   * Is the key is "permanent". Permanent key is not treats as invalid when it expires
   */
  permanent: boolean;
  /**
   * Key lifetime in milliseconds
   */
  expiresIn: number;
  /**
   * The time in unixtime when the key was created
   */
  createdAt: number;
  /**
   * Key value
   */
  value: R;
  /**
   * Cache tags Array with pairs of tag name and version. The version is stored as unixtime.
   */
  tags: Tag[];

  constructor(key: string, value: R, tags: Tag[], options: WriteOptions<R> = {}) {
    const { expiresIn = 0 } = options;

    this.key = key;
    this.value = value;
    this.tags = tags;
    this.permanent = expiresIn === 0;
    this.expiresIn = expiresIn;
    this.createdAt = Date.now();

    if (value === undefined) {
      this.tags = [];
    }
  }
}
