import { ConnectionStatus } from '../../connection-status';
import { StorageAdapterOptions, StorageAdapter } from '../../storage-adapter';

class TestStorageAdapter implements StorageAdapter {
  options: StorageAdapterOptions;
  testInterface: any;
  isConnected: boolean;
  internalStorage: any;

  constructor(testInstance: any, isConnected: boolean = true) {
    this.testInterface = testInstance;
    this.testInterface.internalStorage = {};
    this.isConnected = isConnected;
  }

  checkConnection(): void {
    if (!this.isConnected) {
      throw new Error('No connection');
    }
  }

  getConnectionStatus(): ConnectionStatus {
    return this.isConnected ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED;
  }

  onConnect(): ConnectionStatus {
    return this.getConnectionStatus();
  }

  async set(key: string, value: string): Promise<boolean> {
    this.checkConnection();
    this.testInterface.internalStorage[key] = value;

    return true;
  }

  async get(key: string): Promise<string> {
    this.checkConnection();

    return this.testInterface.internalStorage[key];
  }

  async del(key: string): Promise<any> {
    this.checkConnection();

    if (this.testInterface.internalStorage[key]) {
      delete this.testInterface.internalStorage[key];

      return 1;
    }

    return 0;
  }

  async acquireLock(key: string): Promise<boolean> {
    this.checkConnection();

    return this.set(`${key}_lock`, '');
  }

  async releaseLock(key: string): Promise<boolean> {
    this.checkConnection();

    const deletedKeys = await this.del(`${key}_lock`);

    return deletedKeys > 0;
  }

  async isLockExists(key: string): Promise<boolean> {
    this.checkConnection();

    return !!this.testInterface.internalStorage[`${key}_lock`];
  }

  async mset(values:  Map<string, any>): Promise<void> {
    this.checkConnection();
    values.forEach((value, key) => {
      this.testInterface.internalStorage[key] = value;
    });
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    this.checkConnection();

    return keys.map(key => this.testInterface.internalStorage[key] ?? null);
  }

  async addToSet(key: string, values: string[]): Promise<void> {
    let set = this.testInterface.internalStorage[key];
    if (set instanceof Set) {
      values.forEach(value => set.add(value));
    } else {
      set = new Set(values);
    }

    this.testInterface.internalStorage[key] = set;
  }

  async deleteFromSet(key: string, values: string[]): Promise<void> {
    const set = this.testInterface.internalStorage[key];
    if (set instanceof Set) {
      values.forEach(value => set.delete(value));
    }
  }

  private async getSetValues(key: string): Promise<Set<string>> {
    const set = this.testInterface.internalStorage[key];
    if (set instanceof Set) {
      return set;
    }
    return new Set();
  }

  async intersectWithSet(key: string, values: string[]): Promise<Set<string>> {
    const set = await this.getSetValues(key);

    return new Set(values.filter(x => set.has(x)));
  }
}

export default TestStorageAdapter;
