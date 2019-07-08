import ReadThroughManager from './read-through';
import TestStorage from '../storages/__mocks__/test';
import { ConnectionStatus } from '../connection-status';

const logger = {
  info: jest.fn(),
  trace: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
let internalStorage = {};
let storage;
let manager;

describe('ReadThroughManager', () => {
  beforeEach(() => {
    internalStorage = {};
    storage = new TestStorage(internalStorage);
    manager = new ReadThroughManager({
      storage,
      prefix: 'cache',
      hashKeys: false,
      expiresIn: 10000,
      logger
    });
  });

  it('registers new expiration strategies given in options', () => {
    const mockLockedKeyRetrieveStrategy = {
      getName: (): string => 'test',
      get: jest.fn().mockResolvedValue(true)
    };
    const instance: any = new ReadThroughManager({
      storage: new TestStorage(internalStorage),
      lockedKeyRetrieveStrategies: [['test', mockLockedKeyRetrieveStrategy]],
      logger
    });

    expect(instance.lockedKeyRetrieveStrategies.get('test')).toEqual(mockLockedKeyRetrieveStrategy);
  });

  it('getLockedKeyRetrieveStrategy throws if cannot get strategy', () => {
    expect(() => manager.getLockedKeyRetrieveStrategy('unknown')).toThrow();
  });

  it('get returns result from executor if key lock throws error', async () => {
    await manager.set('test', undefined);

    storage.lockKey = (): boolean => { throw new Error('connection error'); };
    expect(await manager.get('test', () => '234')).toEqual('234');
  });

  it('get returns result if it exists', async () => {
    await manager.set('test', '123', { expiresIn: 100 });

    expect(await manager.get('test', () => { /* empty */ })).toEqual('123');
  });

  it('get runs executor and updates key if it not exists', async () => {
    storage.get.mockResolvedValueOnce(null);
    expect(await manager.get('test', () => '234')).toEqual('234');
    expect(await storage.get('test')).toMatchObject({ value: '\"234\"'});
  });

  it('get runs executor and updates key if storage record expired', async () => {
    const DATE = 1550082589777;
    const DATE_ADVANCED = 1550082599777;
    const realNow = Date.now;

    Date.now = jest.fn().mockReturnValue(DATE);

    const returnMock = {
      key: 'test',
      value: JSON.stringify('234'),
      permanent: false,
      expiresIn: 100,
      createdAt: Date.now()
    };

    (Date.now as any).mockReturnValueOnce(DATE_ADVANCED);

    storage.get.mockResolvedValueOnce(returnMock);
    expect(await manager.get('test', () => '234')).toEqual('234');
    expect(await storage.get('test')).toMatchObject({ key: 'test', value: '\"234\"'});
    Date.now = realNow;
  });

  it('get runs executor and updates key if storage has record with undefined value', async () => {
    await manager.set('test', undefined);

    expect(await manager.get('test', () => '234')).toEqual('234');
    expect(storage.storage).toEqual({ test: '234'});
  });

  it('get runs executor and updates key if record tags outdated', async () => {
    storage.getTags.mockResolvedValueOnce([{ name: 'tag1', version: 2 }]);
    storage.get.mockResolvedValueOnce({
      key: 'test',
      value: JSON.stringify('234'),
      permanent: true,
      tags: [{ name: 'tag1', version: 1 }]
    });

    expect(await manager.get('test', () => '234')).toEqual('234');
    expect(storage.storage).toEqual({ test: '234'});
  });

  it('get runs executor and updates key if cannot get tags', async () => {
    storage.getTags.mockImplementationOnce(() => { throw new Error('Operation timeout'); });
    storage.get.mockResolvedValueOnce({
      key: 'test',
      value: JSON.stringify('234'),
      permanent: true,
      tags: [{ name: 'tag1', version: 1 }]
    });

    expect(await manager.get('test', () => '234')).toEqual('234');
    expect(storage.storage).toEqual({ test: '234'});
  });

  it('get throws if executor throws', async () => {
    await expect(manager.get('test3', async () => {
      throw new Error('failed');
    })).rejects.toThrow('failed');
  });

  it('get returns result from executor if adapter methods throws errors', async () => {
    (storage.getConnectionStatus as any).mockReturnValueOnce(ConnectionStatus.DISCONNECTED);

    const result = await manager.get('test3', async () => ({ test: 123 }));

    expect(result).toEqual({ test: 123 });
  });

  it('get returns result from executor if storage methods throws errors', async () => {
    const testStorage = new TestStorage(internalStorage);

    testStorage.get.mockImplementation(async () => { throw new Error('Operation timeout after 200'); });

    const testManager: any = new ReadThroughManager({
      storage: testStorage,
      logger
    });

    await expect(testManager.get('test', async () => ({ test: 123 }))).resolves.toEqual({ test: 123 });
  });
});
