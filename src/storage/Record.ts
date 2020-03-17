import { Tag, WriteOptions } from "./Storage";

export type RecordValue = object | string | number | null;

export class Record {
  /**
   * Checks if provided value is valid Record.
   */
  static isRecord(value: any): value is Record {
    return value === null || (typeof value === "object" && value.key);
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
  value?: RecordValue;
  /**
   * Cache tags Array with pairs of tag name and version. The version is stored as unixtime.
   */
  tags: Tag[];

  constructor(key: string, value: RecordValue, tags: Tag[], options: WriteOptions = {}) {
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
