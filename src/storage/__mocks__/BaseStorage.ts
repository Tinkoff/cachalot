import { Storage } from '../Storage';
import { ConnectionStatus } from '../../ConnectionStatus';

export class BaseStorage implements Storage {
  storage: any;
  get: any = jest.fn().mockImplementation((key: string) => ({ key, value: JSON.stringify(this.storage[key]), permanent: true }));
  touch: any = jest.fn();
  lockKey: any = jest.fn().mockResolvedValue(true);
  releaseKey: any = jest.fn();
  keyIsLocked: any = jest.fn().mockReturnValue(false);
  del: any = jest.fn();
  getTags: any = jest.fn();
  set: any = jest.fn().mockImplementation((key: string, value: any) => {
    this.storage[key] = value;
  });
  getConnectionStatus: any = jest.fn().mockReturnValue(ConnectionStatus.CONNECTED);

  constructor(storage: any) {
    this.storage = storage;
  }
}
