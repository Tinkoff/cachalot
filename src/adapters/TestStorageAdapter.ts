import { ConnectionStatus } from "../ConnectionStatus";
import { StorageAdapter } from "../StorageAdapter";

class TestStorageAdapter implements StorageAdapter {
  internalStorage: Record<string, string>;
  isConnected: boolean;

  constructor(storage: Record<string, string> = {}, isConnected = true) {
    this.internalStorage = storage;
    this.isConnected = isConnected;
  }

  checkConnection(): void {
    if (!this.isConnected) {
      throw new Error("No connection");
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
    this.internalStorage[key] = value;

    return true;
  }

  async get(key: string): Promise<string> {
    this.checkConnection();

    return this.internalStorage[key];
  }

  async del(key: string): Promise<boolean> {
    this.checkConnection();

    if (this.internalStorage[key]) {
      delete this.internalStorage[key];

      return true;
    }

    return false;
  }

  async acquireLock(key: string): Promise<boolean> {
    this.checkConnection();

    return this.set(`${key}_lock`, "");
  }

  async releaseLock(key: string): Promise<boolean> {
    this.checkConnection();

    return this.del(`${key}_lock`);
  }

  async isLockExists(key: string): Promise<boolean> {
    this.checkConnection();

    return !!this.internalStorage[`${key}_lock`];
  }

  async mset(values: Map<string, string>): Promise<void> {
    this.checkConnection();
    values.forEach((value, key) => {
      this.internalStorage[key] = value;
    });
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    this.checkConnection();

    return keys.map(key => this.internalStorage[key] || null);
  }

  setOptions(): void {
    return undefined;
  }
}

export default TestStorageAdapter;
